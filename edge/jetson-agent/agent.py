#!/usr/bin/env python3
"""
Vector Jetson stub agent — Phases 0–1.

Flow:
  1. Rider taps Start on the phone (creates capture + t0)
  2. This agent attaches → receives capture_session_id, t0, session_token
  3. Heartbeats while "recording"
  4. Uploads a video file stamped at sync_offset_ms=0
  5. Calls complete (manifest). Rider still Ends on the phone.

Env:
  VECTOR_API_BASE=http://localhost:3000
  EDGE_DEVICE_KEY=...
  EDGE_DEVICE_SECRET=...
  EDGE_VIDEO_PATH=/path/to/sample.mp4   # optional but recommended
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise SystemExit(f"Missing env {name}")
    return v


def req(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    data: bytes | None = None,
) -> dict:
    request = urllib.request.Request(
        url, data=data, headers=dict(headers or {}), method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} → {e.code}: {err_body}") from e


def multipart(
    url: str,
    token: str,
    fields: dict[str, str],
    file_field: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> dict:
    boundary = f"----VectorEdge{int(time.time() * 1000)}"
    chunks: list[bytes] = []
    for k, v in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        chunks.append(v.encode())
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}\r\n".encode())
    chunks.append(
        (
            f'Content-Disposition: form-data; name="{file_field}"; '
            f'filename="{filename}"\r\n'
        ).encode()
    )
    chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode())
    chunks.append(content)
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return req(
        "POST",
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        data=b"".join(chunks),
    )


def tiny_mp4() -> bytes:
    """Placeholder only — set EDGE_VIDEO_PATH for real playback."""
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 512)


def main() -> None:
    base = env("VECTOR_API_BASE", "http://localhost:3000").rstrip("/")
    device_key = env("EDGE_DEVICE_KEY")
    device_secret = env("EDGE_DEVICE_SECRET")
    video_path = os.environ.get("EDGE_VIDEO_PATH")

    edge_auth = f"Edge {device_key}:{device_secret}"
    print("Attaching to open lesson…")
    attach = req(
        "POST",
        f"{base}/api/edge/sessions/attach",
        headers={"Authorization": edge_auth, "Content-Type": "application/json"},
        data=b"{}",
    )
    capture_id = attach["capture_session_id"]
    t0 = attach["t0"]
    token = attach["session_token"]
    print(json.dumps({"capture_session_id": capture_id, "t0": t0}, indent=2))

    print("Heartbeat (recording)…")
    req(
        "POST",
        f"{base}/api/edge/sessions/{capture_id}/heartbeat",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(
            {"recording": True, "layers": {"video": True, "sensors": False}}
        ).encode(),
    )

    if video_path and Path(video_path).is_file():
        content = Path(video_path).read_bytes()
        filename = Path(video_path).name
        ctype = "video/webm" if filename.endswith(".webm") else "video/mp4"
    else:
        print(
            "WARN: EDGE_VIDEO_PATH not set — uploading tiny placeholder. "
            "Set EDGE_VIDEO_PATH to a real mp4 for playback testing."
        )
        content = tiny_mp4()
        filename = "stub.mp4"
        ctype = "video/mp4"

    print(f"Uploading video ({len(content)} bytes)…")
    uploaded = multipart(
        f"{base}/api/edge/sessions/{capture_id}/video",
        token,
        {"sync_offset_ms": "0", "chunk_id": "main"},
        "file",
        filename,
        content,
        ctype,
    )
    print(json.dumps(uploaded, indent=2))

    print("Complete…")
    done = req(
        "POST",
        f"{base}/api/edge/sessions/{capture_id}/complete",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=b"{}",
    )
    print(json.dumps(done, indent=2))
    print("Done. Rider Ends on the phone; debrief shows video + transcript on t0.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
