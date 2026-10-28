#!/usr/bin/env python3
"""Verify or restore the five original Xuanji5 commits without changing HEAD.

The compatible history carries every original blob except the oversized Blender
source. Small original commit/tree payloads are in the accompanying JSON archive.
Default operation is read-only verification. --restore writes Git objects only;
an optional --ref creates a separate reference after exact SHA-1 verification.
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def git(repo, *args, data=None, check=True):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], input=data, capture_output=True,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
    return result


def object_sha(kind, payload):
    header = f"{kind} {len(payload)}\0".encode("ascii")
    return hashlib.sha1(header + payload).hexdigest()


def require_repo(repo):
    git(repo, "rev-parse", "--git-dir")
    fmt = git(repo, "rev-parse", "--show-object-format").stdout.strip()
    if fmt != b"sha1":
        raise RuntimeError("This archive restores an SHA-1 Git repository.")


def existing_objects(repo, hashes):
    query = ("\n".join(hashes) + "\n").encode("ascii")
    result = git(repo, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)", data=query)
    found = {}
    for row in result.stdout.decode("ascii").splitlines():
        fields = row.split()
        if len(fields) == 3:
            found[fields[0]] = (fields[1], int(fields[2]))
    return found


def inspect_model(path, model):
    if not path.is_file():
        return False
    if path.stat().st_size != model["bytes"]:
        raise RuntimeError(f"Source model has the wrong size: {path}")
    sha256 = hashlib.sha256()
    sha1 = hashlib.sha1(f"blob {model['bytes']}\0".encode("ascii"))
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            sha256.update(chunk)
            sha1.update(chunk)
    if sha256.hexdigest() != model["sha256"] or sha1.hexdigest() != model["blobSha1"]:
        raise RuntimeError(f"Source model hash mismatch: {path}")
    return True


def write_object(repo, kind, payload, expected):
    actual = git(repo, "hash-object", "-w", "--stdin", "-t", kind, data=payload).stdout.decode("ascii").strip()
    if actual != expected:
        raise RuntimeError(f"Restored {kind} SHA mismatch: expected {expected}, got {actual}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Git repository containing the compatible history")
    parser.add_argument("--archive", type=Path, default=Path(__file__).with_name("archive-original-history.json"))
    parser.add_argument("--source-model", type=Path, help="Byte-identical original Blender source")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--verify", action="store_true", help="Read-only verification (the default)")
    mode.add_argument("--restore", action="store_true", help="Write missing original Git objects; leave refs unchanged unless --ref is given")
    parser.add_argument("--ref", help="Optional new full refs/... name; never overwrites a different existing ref or the current branch")
    args = parser.parse_args()
    if args.ref and not args.restore:
        parser.error("--ref requires --restore")

    repo = args.repo.resolve()
    require_repo(repo)
    archive = json.loads(args.archive.read_text(encoding="utf-8"))
    if archive.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported archive schema.")
    model = archive["originalModel"]
    source_model = (args.source_model or repo / model["existingSourcePath"]).resolve()

    payloads = []
    for entry in archive["objects"]:
        payload = base64.b64decode(entry["base64"], validate=True)
        if entry["type"] not in ("commit", "tree"):
            raise RuntimeError("Only original commit and tree payloads may be embedded.")
        if object_sha(entry["type"], payload) != entry["sha1"]:
            raise RuntimeError(f"Archive payload hash mismatch: {entry['sha1']}")
        payloads.append((entry, payload))

    found = existing_objects(repo, archive["requiredBlobSha1s"])
    missing_shared = [h for h in archive["requiredBlobSha1s"] if h != model["blobSha1"] and h not in found]
    if missing_shared:
        raise RuntimeError(
            f"Missing {len(missing_shared)} shared blobs. Fetch the compatible history first. "
            f"First missing SHA: {missing_shared[0]}"
        )
    if any(found[h][0] != "blob" for h in found):
        raise RuntimeError("An expected shared blob has an unexpected object type.")
    model_present = model["blobSha1"] in found
    source_valid = inspect_model(source_model, model) if source_model.is_file() else False
    if not model_present and not source_valid:
        raise RuntimeError(
            "The oversized original model blob is intentionally absent from compatible history. "
            f"Supply --source-model with the byte-identical Blender file (SHA256 {model['sha256']})."
        )

    ref_previous = None
    if args.ref:
        if not args.ref.startswith("refs/"):
            raise RuntimeError("Use a full refs/... name, for example refs/archive/xuanji5-original.")
        git(repo, "check-ref-format", args.ref)
        current = git(repo, "symbolic-ref", "-q", "HEAD", check=False).stdout.decode("utf-8").strip()
        if current == args.ref:
            raise RuntimeError("Refusing to update the current branch; choose a separate archive ref.")
        prior = git(repo, "rev-parse", "--verify", args.ref, check=False)
        if prior.returncode == 0:
            ref_previous = prior.stdout.decode("ascii").strip()
            if ref_previous != archive["originalHead"]:
                raise RuntimeError(f"Refusing to overwrite existing ref {args.ref}.")

    restored = False
    if args.restore:
        if not model_present:
            # The source is a raw byte file; do not apply checkout/attribute filters.
            actual = git(repo, "hash-object", "-w", "--no-filters", str(source_model)).stdout.decode("ascii").strip()
            if actual != model["blobSha1"]:
                raise RuntimeError("Original model blob was not restored exactly.")
        for entry, payload in payloads:
            write_object(repo, entry["type"], payload, entry["sha1"])
        for commit in archive["originalCommits"]:
            actual = git(repo, "rev-parse", "--verify", commit + "^{commit}").stdout.decode("ascii").strip()
            if actual != commit:
                raise RuntimeError(f"Original commit was not restored: {commit}")
        git(repo, "fsck", "--connectivity-only", "--no-reflogs", archive["originalHead"])
        if args.ref and ref_previous is None:
            git(repo, "update-ref", args.ref, archive["originalHead"], "0" * 40)
        restored = True

    print(json.dumps({
        "mode": "restore" if restored else "verify",
        "originalHead": archive["originalHead"],
        "originalCommitCount": len(archive["originalCommits"]),
        "archivedSmallObjectCount": len(payloads),
        "requiredBlobCount": len(archive["requiredBlobSha1s"]),
        "sharedBlobsVerified": len(archive["requiredBlobSha1s"]) - 1,
        "originalModelAlreadyPresent": model_present,
        "sourceModelVerified": source_valid,
        "ref": args.ref if restored else None,
        "refsChanged": bool(restored and args.ref and ref_previous is None),
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
