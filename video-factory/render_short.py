#!/usr/bin/env python3
"""Minimal timeline -> 9:16 MP4 renderer (proof of pipeline).

Usage: python3 scripts/render_short.py timeline.json out/short.mp4
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = str(ROOT / "bin" / "ffmpeg")
FONT = str(ROOT / "bin" / "NotoSansJP-Bold.otf")


def esc(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("%", "\\%")
    )


def render(timeline_path: str, out_path: str) -> None:
    tl = json.loads(Path(timeline_path).read_text(encoding="utf-8"))
    w, h, fps = tl["canvas"]["width"], tl["canvas"]["height"], tl["canvas"]["fps"]
    scene = tl["scenes"][0]
    c1, c2 = scene["colors"]
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        bg = str(Path(td) / "bg.png")
        from PIL import Image, ImageDraw

        img = Image.new("RGB", (w, h))
        top, bottom = tuple(int(c1[i:i + 2], 16) for i in (1, 3, 5)), tuple(
            int(c2[i:i + 2], 16) for i in (1, 3, 5)
        )
        for y in range(h):
            t = y / h
            row = tuple(int(a + (b - a) * t) for a, b in zip(top, bottom))
            ImageDraw.Draw(img).line([(0, y), (w, y)], fill=row)
        img.save(bg)

        vf = [
            f"scale={w}:{h}",
            f"zoompan=z='{scene['zoom']['start']}+({scene['zoom']['end']}-"
            f"{scene['zoom']['start']})*on/({int(scene['duration'] * fps)}-1)':"
            f"d={int(scene['duration'] * fps)}:s={w}x{h}:fps={fps}",
            f"drawtext=fontfile={FONT}:text='{esc(scene['title'])}':"
            f"fontsize=82:fontcolor=white:x=(w-text_w)/2:y=560",
        ]
        for cap in scene["captions"]:
            vf.append(
                f"drawtext=fontfile={FONT}:text='{esc(cap['text'])}':"
                f"fontsize=64:fontcolor=0x8be9fd:borderw=4:bordercolor=black:"
                f"x=(w-text_w)/2:y=1400:"
                f"enable='between(t,{cap['start']},{cap['end']})'"
            )

        cmd = [
            FFMPEG, "-y", "-i", bg,
            "-f", "lavfi", "-t", str(scene["duration"]),
            "-i", f"sine=frequency=220:sample_rate=44100",
            "-vf", ",".join(vf),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-movflags", "faststart",
            "-c:a", "aac", "-b:a", "96k", "-af", f"volume={tl['audio']['bgm_gain_db']}dB",
            "-t", str(scene["duration"]), "-r", str(fps), out_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True, text=True)

    probe = subprocess.run(
        [FFMPEG if False else str(ROOT / "bin" / "ffmpeg").replace("ffmpeg", "ffmpeg")],
        capture_output=True,
    )
    info = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", out_path], capture_output=True, text=True
    )
    for line in info.stderr.splitlines():
        if "Stream" in line or "Duration" in line:
            print(line.strip())


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
