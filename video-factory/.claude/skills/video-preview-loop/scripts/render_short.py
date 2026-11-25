#!/usr/bin/env python3
"""Minimal timeline -> 9:16 MP4 renderer (proof of pipeline).

Usage: python3 scripts/render_short.py timeline.json out/short.mp4
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR  # skill dir; outputs go to cwd/out and cwd/tmp




def _bootstrap_ffmpeg():
    local = SCRIPT_DIR / "bin" / "ffmpeg"
    if not local.exists():
        import shutil, imageio_ffmpeg
        local.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), local)
        local.chmod(0o755)
    return str(local)


def _bootstrap_font():
    local = SCRIPT_DIR / "bin" / "NotoSansJP-Bold.otf"
    if not local.exists():
        import urllib.request
        local.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(
            "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/"
            "Japanese/NotoSansCJKjp-Bold.otf", local)
    return str(local)


FFMPEG = _bootstrap_ffmpeg()
FONT = _bootstrap_font()


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

    info = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", out_path], capture_output=True, text=True
    )
    for line in info.stderr.splitlines():
        if "Stream" in line or "Duration" in line:
            print(line.strip())


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
