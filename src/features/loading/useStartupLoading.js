// Chapter modules prepare independently while the entry video is already visible.
export function withStartupTimeout(promise, milliseconds = 25_000, message = '资源准备超时') {
  let timeout;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), milliseconds); }),
  ]).finally(() => clearTimeout(timeout));
}
