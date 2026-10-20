// Distribution-only wrapper. Compatible with the Windows .NET Framework C# 5 compiler.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class SiteFile
{
    public string path { get; set; }
    public long bytes { get; set; }
    public string sha256 { get; set; }
}
internal sealed class SiteManifest
{
    public string buildId { get; set; }
    public string revision { get; set; }
    public SiteFile[] files { get; set; }
}

internal static class PortableLauncher
{
    private static readonly ManualResetEvent Stopped = new ManualResetEvent(false);
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static Dictionary<string, SiteFile> files;
    private static SiteManifest manifest;
    private static string manifestJson, siteRoot, origin, statusFile, dataRoot;
    private static readonly string token = Guid.NewGuid().ToString("N");
    private static TcpListener listener;
    private static Process browser;
    private static Form window;
    private static bool serveOnly;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            serveOnly = args.Contains("--serve-only");
            statusFile = Option(args, "--status-file=", null);
            dataRoot = Path.GetFullPath(Option(args, "--data-dir=", Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SouthWindLionPortable")));
            int port;
            if (!Int32.TryParse(Option(args, "--port=", "47851"), out port) || port < 0 || port > 65535)
                throw new ArgumentException("Invalid local port.");
            using (var stream = Resource("site.manifest.json"))
            using (var reader = new StreamReader(stream, Encoding.UTF8)) manifestJson = reader.ReadToEnd();
            manifest = Json.Deserialize<SiteManifest>(manifestJson);
            if (manifest == null || manifest.files == null || manifest.files.Length == 0 ||
                String.IsNullOrEmpty(manifest.buildId) || manifest.buildId.Any(c => !Uri.IsHexDigit(c)))
                throw new InvalidDataException("Invalid embedded manifest.");
            files = new Dictionary<string, SiteFile>(StringComparer.Ordinal);
            foreach (var file in manifest.files)
            {
                if (!SafePath(file.path) || file.bytes < 0 || file.sha256 == null || file.sha256.Length != 64)
                    throw new InvalidDataException("Invalid embedded file record.");
                files.Add(file.path, file);
            }
            PrepareSite();
            listener = new TcpListener(IPAddress.Loopback, port);
            try { listener.Start(); }
            catch (SocketException)
            {
                if (port == 0) throw;
                listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
            }
            origin = "http://127.0.0.1:" + ((IPEndPoint)listener.LocalEndpoint).Port;
            var accept = new Thread(AcceptClients) { IsBackground = true }; accept.Start();
            WriteStatus(new { state = "ready", origin = origin, pid = Process.GetCurrentProcess().Id,
                siteRoot = siteRoot, fileCount = files.Count, shutdownToken = token, buildId = manifest.buildId });
            AppDomain.CurrentDomain.ProcessExit += delegate { Stop(); };
            if (serveOnly) Stopped.WaitOne();
            else RunWindow();
            Stop(); return 0;
        }
        catch (Exception error)
        {
            try { WriteStatus(new { state = "error", message = error.Message }); } catch { }
            Stop();
            if (!serveOnly) MessageBox.Show("展示程序未能启动：\n" + error.Message +
                "\n\n请保留 EXE 与错误信息，不要删除开发工程。", "南风有狮", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string Option(string[] args, string prefix, string fallback)
    {
        var arg = args.FirstOrDefault(value => value.StartsWith(prefix, StringComparison.Ordinal));
        return arg == null ? fallback : arg.Substring(prefix.Length);
    }
    private static Stream Resource(string name)
    {
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
        if (stream == null) throw new InvalidDataException("Missing embedded resource: " + name);
        return stream;
    }
    private static bool SafePath(string path)
    {
        return !String.IsNullOrEmpty(path) && !path.StartsWith("/", StringComparison.Ordinal) &&
            path.IndexOfAny(new[] { '\\', '\0', ':' }) < 0 &&
            path.Split('/').All(part => part.Length > 0 && part != "." && part != "..");
    }
    private static string FilePath(string path) { return Path.Combine(siteRoot, path.Replace('/', Path.DirectorySeparatorChar)); }
    private static string HashFile(string path)
    {
        using (var sha = SHA256.Create())
        using (var stream = File.OpenRead(path))
            return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
    }
    private static bool VerifiedSite()
    {
        if (!Directory.Exists(siteRoot)) return false;
        try
        {
            if (Directory.GetFiles(siteRoot, "*", SearchOption.AllDirectories).Length != files.Count) return false;
            foreach (var file in manifest.files)
            {
                var path = FilePath(file.path);
                if (!File.Exists(path) || new FileInfo(path).Length != file.bytes || HashFile(path) != file.sha256) return false;
            }
            return true;
        }
        catch (IOException) { return false; }
    }
    private static void PrepareSite()
    {
        Directory.CreateDirectory(dataRoot);
        siteRoot = Path.Combine(dataRoot, "site-" + manifest.buildId);
        using (var mutex = new Mutex(false, "Local\\SouthWindLionExtract-" + manifest.buildId))
        {
            bool owned = false;
            try
            {
                try { owned = mutex.WaitOne(TimeSpan.FromMinutes(2)); } catch (AbandonedMutexException) { owned = true; }
                if (!owned) throw new IOException("Another launcher is still preparing this build. Please retry shortly.");
                if (VerifiedSite()) return;
                // Never erase anything: retain a damaged/partial owned cache for inspection.
                if (Directory.Exists(siteRoot)) Directory.Move(siteRoot, siteRoot + ".quarantine-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(siteRoot);
                var extracted = new HashSet<string>(StringComparer.Ordinal);
                using (var payload = Resource("site.zip"))
                using (var archive = new ZipArchive(payload, ZipArchiveMode.Read))
                {
                    foreach (var entry in archive.Entries)
                    {
                        if (entry.FullName.EndsWith("/", StringComparison.Ordinal)) continue;
                        if (!SafePath(entry.FullName) || !files.ContainsKey(entry.FullName) || !extracted.Add(entry.FullName) ||
                            entry.Length != files[entry.FullName].bytes) throw new InvalidDataException("Invalid embedded ZIP entry.");
                        var path = FilePath(entry.FullName); Directory.CreateDirectory(Path.GetDirectoryName(path));
                        using (var input = entry.Open())
                        using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None)) input.CopyTo(output);
                    }
                }
                if (extracted.Count != files.Count || !VerifiedSite()) throw new InvalidDataException("网页资源完整性校验失败，请重新复制完整 EXE。");
            }
            finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
    private static void WriteStatus(object value)
    {
        if (String.IsNullOrEmpty(statusFile)) return;
        var path = Path.GetFullPath(statusFile); Directory.CreateDirectory(Path.GetDirectoryName(path));
        File.WriteAllText(path, Json.Serialize(value), new UTF8Encoding(false));
    }
    private static void AcceptClients()
    {
        while (!Stopped.WaitOne(0))
        {
            try
            {
                var client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(delegate { Serve(client); });
            }
            catch (SocketException) { if (Stopped.WaitOne(0)) return; Stop(); }
            catch (ObjectDisposedException) { return; }
        }
    }
    private static void Serve(TcpClient client)
    {
        using (client)
        {
            try
            {
                client.ReceiveTimeout = 15000; client.SendTimeout = 30000;
                using (var stream = client.GetStream())
                {
                    var header = new List<byte>(); int value;
                    while ((value = stream.ReadByte()) >= 0)
                    {
                        header.Add((byte)value);
                        if (header.Count > 16384) { Reply(stream, 431, "Request Header Fields Too Large", null, false); return; }
                        int n = header.Count;
                        if (n >= 4 && header[n - 4] == 13 && header[n - 3] == 10 && header[n - 2] == 13 && header[n - 1] == 10) break;
                    }
                    if (value < 0) return;
                    var lines = Encoding.ASCII.GetString(header.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
                    var request = lines[0].Split(' ');
                    if (request.Length != 3 || !request[1].StartsWith("/", StringComparison.Ordinal)) { Reply(stream, 400, "Bad Request", null, false); return; }
                    bool head = request[0] == "HEAD";
                    var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var line in lines.Skip(1).Where(line => line.Length > 0))
                    {
                        int colon = line.IndexOf(':');
                        if (colon <= 0 || headers.ContainsKey(line.Substring(0, colon))) { Reply(stream, 400, "Bad Request", null, head); return; }
                        headers.Add(line.Substring(0, colon), line.Substring(colon + 1).Trim());
                    }
                    string host;
                    var authority = new Uri(origin).Authority;
                    if (!headers.TryGetValue("Host", out host) || (host != authority && host != "localhost:" + new Uri(origin).Port))
                    { Reply(stream, 403, "Forbidden", null, head); return; }
                    string target = request[1], path;
                    int query = target.IndexOf('?');
                    try { path = Uri.UnescapeDataString(query < 0 ? target : target.Substring(0, query)); }
                    catch (UriFormatException) { Reply(stream, 400, "Bad Request", null, head); return; }
                    if (path.IndexOfAny(new[] { '\\', '\0', ':' }) >= 0 || path.Split('/').Any(part => part == "." || part == ".."))
                    { Reply(stream, 403, "Forbidden", null, head); return; }
                    if (path == "/_portable/shutdown")
                    {
                        if (request[0] != "POST") { Reply(stream, 405, "Method Not Allowed", null, head); return; }
                        if (target != "/_portable/shutdown?token=" + token) { Reply(stream, 403, "Forbidden", null, false); return; }
                        Reply(stream, 200, "OK", Encoding.UTF8.GetBytes("{\"state\":\"stopping\"}"), false);
                        ThreadPool.QueueUserWorkItem(delegate { Stop(); }); return;
                    }
                    if (request[0] != "GET" && !head) { Reply(stream, 405, "Method Not Allowed", null, false); return; }
                    if (path == "/_portable/manifest") { Reply(stream, 200, "OK", Encoding.UTF8.GetBytes(manifestJson), head, "application/json; charset=utf-8"); return; }
                    if (path == "/_portable/status")
                    { Reply(stream, 200, "OK", Encoding.UTF8.GetBytes(Json.Serialize(new { state = "ready", buildId = manifest.buildId, fileCount = files.Count })), head, "application/json; charset=utf-8"); return; }
                    var key = path.TrimStart('/'); if (key.Length == 0) key = "index.html";
                    if (key.EndsWith("/", StringComparison.Ordinal)) key += "index.html";
                    SiteFile file;
                    if (!files.TryGetValue(key, out file)) { Reply(stream, 404, "Not Found", null, head); return; }
                    long start = 0, end = file.bytes - 1; string range; bool partial = headers.TryGetValue("Range", out range);
                    if (partial && !ParseRange(range, file.bytes, out start, out end))
                    { Reply(stream, 416, "Range Not Satisfiable", null, head, null, "Content-Range: bytes */" + file.bytes + "\r\n"); return; }
                    var length = file.bytes == 0 ? 0 : end - start + 1;
                    var extra = "Accept-Ranges: bytes\r\n" + (partial ? "Content-Range: bytes " + start + "-" + end + "/" + file.bytes + "\r\n" : "");
                    WriteHeaders(stream, partial ? 206 : 200, partial ? "Partial Content" : "OK", length, Mime(key), extra);
                    if (!head)
                    {
                        using (var input = File.OpenRead(FilePath(key)))
                        {
                            input.Seek(start, SeekOrigin.Begin); var buffer = new byte[65536]; long left = length;
                            while (left > 0)
                            {
                                int count = input.Read(buffer, 0, (int)Math.Min(buffer.Length, left)); if (count == 0) break;
                                stream.Write(buffer, 0, count); left -= count;
                            }
                        }
                    }
                }
            }
            catch (IOException) { } // Browser cancels video/range requests when changing chapters.
            catch (SocketException) { }
            catch (ObjectDisposedException) { }
        }
    }
    private static bool ParseRange(string value, long size, out long start, out long end)
    {
        start = 0; end = size - 1;
        if (size <= 0 || !value.StartsWith("bytes=", StringComparison.Ordinal) || value.Contains(",")) return false;
        var parts = value.Substring(6).Split('-'); long first, last;
        if (parts.Length != 2) return false;
        if (parts[0].Length == 0)
        {
            if (!Int64.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out last) || last <= 0) return false;
            start = Math.Max(0, size - last); return true;
        }
        if (!Int64.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out first) || first >= size) return false;
        start = first;
        if (parts[1].Length == 0) return true;
        if (!Int64.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out last) || last < first) return false;
        end = Math.Min(last, size - 1); return true;
    }
    private static void WriteHeaders(Stream stream, int code, string reason, long length, string mime, string extra)
    {
        var bytes = Encoding.ASCII.GetBytes("HTTP/1.1 " + code + " " + reason + "\r\nContent-Length: " + length +
            "\r\nContent-Type: " + mime + "\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-cache\r\n" + extra + "\r\n");
        stream.Write(bytes, 0, bytes.Length);
    }
    private static void Reply(Stream stream, int code, string reason, byte[] body, bool head, string mime = null, string extra = "")
    {
        body = body ?? Encoding.UTF8.GetBytes(reason);
        WriteHeaders(stream, code, reason, body.Length, mime ?? "text/plain; charset=utf-8", extra);
        if (!head) stream.Write(body, 0, body.Length);
    }
    private static string Mime(string path)
    {
        switch (Path.GetExtension(path).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": case ".mjs": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".webp": return "image/webp";
            case ".gif": return "image/gif";
            case ".svg": return "image/svg+xml";
            case ".ico": return "image/x-icon";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            case ".ttf": return "font/ttf";
            case ".glb": return "model/gltf-binary";
            case ".mp4": return "video/mp4";
            case ".m4a": return "audio/mp4";
            case ".mp3": return "audio/mpeg";
            case ".wasm": return "application/wasm";
            case ".txt": return "text/plain; charset=utf-8";
            default: return "application/octet-stream";
        }
    }
    private static string BrowserPath()
    {
        var candidates = new[] {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe") };
        var path = candidates.FirstOrDefault(File.Exists);
        if (path == null) throw new FileNotFoundException("请先安装 Microsoft Edge 或 Google Chrome；本程序不会自动安装浏览器。");
        return path;
    }
    private static void OpenBrowser()
    {
        if (browser != null && !browser.HasExited) return;
        // One private profile per launcher process: no shared developer/user browser state.
        var profile = Path.Combine(dataRoot, "browser-profile-" + Process.GetCurrentProcess().Id);
        browser = Process.Start(new ProcessStartInfo(BrowserPath(), "--app=" + origin +
            " --user-data-dir=\"" + profile + "\" --guest --no-first-run --no-default-browser-check --disable-background-mode") { UseShellExecute = false });
    }
    private static void RunWindow()
    {
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        window = new Form { Text = "南风有狮 · 临时展示", ClientSize = new Size(530, 212),
            StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false, Font = new Font("Microsoft YaHei UI", 10), BackColor = Color.FromArgb(250, 244, 232) };
        var title = new Label { Text = "南风有狮  |  展示已就绪", AutoSize = true, Location = new Point(24, 20), Font = new Font("Microsoft YaHei UI", 15, FontStyle.Bold) };
        var hint = new Label { Text = "已校验 " + files.Count + " 个网页文件，资源仅在本机展示。\n" + origin + "\n结束展示请关闭本窗口；不影响开发工程。", AutoSize = true, Location = new Point(24, 64) };
        var open = new Button { Text = "打开展示", Size = new Size(128, 36), Location = new Point(24, 152) };
        open.Click += delegate { try { OpenBrowser(); } catch (Exception e) { MessageBox.Show(window, e.Message, "无法打开浏览器"); } };
        var exit = new Button { Text = "退出程序", Size = new Size(128, 36), Location = new Point(168, 152) };
        exit.Click += delegate { window.Close(); };
        window.Controls.AddRange(new Control[] { title, hint, open, exit });
        window.Shown += delegate { open.PerformClick(); };
        window.FormClosed += delegate { Stop(); };
        Application.Run(window);
    }
    private static void Stop()
    {
        if (Stopped.WaitOne(0)) return;
        Stopped.Set();
        if (listener != null) listener.Stop();
        if (browser != null)
        {
            try
            {
                if (!browser.HasExited)
                {
                    browser.CloseMainWindow();
                    if (!browser.WaitForExit(3000))
                    {
                        // Bounded fallback only for our own private-profile process tree.
                        // Never terminate by image name or touch existing user browsers.
                        using (var killer = Process.Start(new ProcessStartInfo(
                            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "taskkill.exe"),
                            "/PID " + browser.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true }))
                            killer.WaitForExit(5000);
                    }
                }
            }
            catch (InvalidOperationException) { } // The owned browser exited concurrently.
        }
        if (window != null && !window.IsDisposed && window.IsHandleCreated)
            try { window.BeginInvoke(new Action(delegate { window.Close(); })); } catch (InvalidOperationException) { }
    }
}
