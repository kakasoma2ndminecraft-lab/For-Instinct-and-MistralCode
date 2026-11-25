#!/usr/bin/env python3
"""Fake SaaS UI short: 1080x1920 deterministic renderer with fast preview loop.

Modes:
  full    : 1080x1920 @30fps MP4  (final render, one per approved edit)
  preview : 270x480   @15fps draft MP4 + 12-frame contact sheet PNG
            (what the screen will look like, seconds instead of minutes)
"""
import argparse
import math
import subprocess
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR  # skill dir; outputs go to cwd/out and cwd/tmp

OUT_DIR = Path.cwd() / "out"
TMP_DIR = Path.cwd() / "tmp"


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

BASE_W, BASE_H, DUR = 1080, 1920, 7.0
BG_TOP, BG_BOT = (11, 16, 38), (30, 58, 138)
TXT_DARK, TXT_GRAY = (20, 27, 45), (120, 132, 155)

CARDS = [
    {"name": "sales_deck.pdf", "icon": (236, 72, 153), "glyph": "PDF",
     "in": 0.35, "done": 2.1},
    {"name": "annual_report.xlsx", "icon": (34, 197, 94), "glyph": "XLS",
     "in": 0.75, "done": 2.9},
    {"name": "consult_notes.doc", "icon": (59, 130, 246), "glyph": "DOC",
     "in": 1.15, "done": 3.7},
]
RESULT_AT = 4.3

_fonts = {}


def F(scale, size):
    key = int(round(size * scale))
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT, max(key, 8))
    return _fonts[key]


def ease_out_back(t, s=1.7):
    t -= 1
    return 1 + t * t * ((s + 1) * t + s)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def background(scale):
    w, h = int(BASE_W * scale), int(BASE_H * scale)
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(BG_TOP, BG_BOT, y / h))
    return img.convert("RGBA")


def rounded_card(w, h, scale, radius, fill):
    w, h = int(w * scale), int(h * scale)
    m = Image.new("RGBA", (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([4, 4, 4 + w, 4 + h], radius=int(radius * scale),
                        fill=fill)
    return m.filter(ImageFilter.GaussianBlur(0.5))


def frame(t, scale, bg):
    W, H = bg.size
    p = lambda v: int(v * scale)
    img = bg.copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    ta = min(max((t - 0.05) / 0.5, 0), 1)
    ty = p(lerp(330, 300, ta))
    d.text((W // 2, ty), "AI File Analyzer", font=F(scale, 84), anchor="mm",
           fill=(255, 255, 255, int(255 * ta)))
    d.text((W // 2, ty + p(90)), "Vision-powered document intelligence",
           font=F(scale, 36), anchor="mm",
           fill=(160, 178, 210, int(230 * ta)))

    for i, c in enumerate(CARDS):
        y_top = p(560 + i * 210)
        ain = ease_out_back(min(max((t - c["in"]) / 0.55, 0), 1))
        if ain <= 0:
            continue
        dy = int(lerp(p(70), 0, ain))
        ca = int(255 * min(max((t - c["in"]) / 0.35, 0), 1))
        ov.alpha_composite(rounded_card(840, 150, scale, 28, (255, 255, 255, ca)),
                           ((W - int(840 * scale)) // 2 - 4, y_top + dy - 4))
        d = ImageDraw.Draw(ov)
        ix, iy = (W - p(840)) // 2 + p(34), y_top + dy + p(33)
        iw = p(84)
        d.rounded_rectangle([ix, iy, ix + iw, iy + iw], radius=p(18),
                            fill=c["icon"] + (ca,))
        d.text((ix + iw / 2, iy + iw / 2), c["glyph"], font=F(scale, 26),
               anchor="mm", fill=(255, 255, 255, ca))
        tx = ix + iw + p(30)
        d.text((tx, iy + p(28)), c["name"], font=F(scale, 40), anchor="lm",
               fill=TXT_DARK + (ca,))
        if t >= c["done"]:
            status, col = "Done", (34, 197, 94)
        else:
            status, col = f"Analyzing{'.' * (1 + int(t * 3) % 3)}", TXT_GRAY
        d.text((tx, iy + p(82)), status, font=F(scale, 30), anchor="lm",
               fill=col + (ca,))
        bar = iy + iw + p(14)
        prog = min(max((t - c["in"] - 0.3) / (c["done"] - c["in"] - 0.3), 0), 1)
        d.rounded_rectangle([tx, bar, tx + p(560), bar + p(10)], radius=p(5),
                            fill=(228, 233, 242, ca))
        if prog > 0:
            d.rounded_rectangle([tx, bar, tx + int(p(560) * prog), bar + p(10)],
                                radius=p(5), fill=c["icon"] + (ca,))

    ra = ease_out_back(min(max((t - RESULT_AT) / 0.6, 0), 1))
    if ra > 0:
        rh = p(300)
        ry = int(lerp(p(620), p(560), ra))
        ov.alpha_composite(rounded_card(840, 300, scale, 32,
                                        (255, 255, 255, int(255 * ra))),
                           ((W - p(840)) // 2, ry))
        d = ImageDraw.Draw(ov)
        d.text((W // 2, ry + p(70)), "Summary Ready", font=F(scale, 52),
               anchor="mm", fill=TXT_DARK + (int(255 * ra),))
        for j, (k, v) in enumerate([("3 files processed", "0.9s"),
                                    ("Insights extracted", "12"),
                                    ("Confidence", "97.4%")]):
            yy = ry + p(150) + p(46) * j
            d.text((W // 2 - p(350), yy), k, font=F(scale, 30), anchor="lm",
                   fill=TXT_GRAY + (int(255 * ra),))
            d.text((W // 2 + p(350), yy), v, font=F(scale, 30), anchor="rm",
                   fill=TXT_DARK + (int(255 * ra),))

    return Image.alpha_composite(img, ov).convert("RGB")


def encode(png_dir, fps, out, crf=23, scale=1.0):
    Path(out).parent.mkdir(exist_ok=True)
    extra = []
    if scale != 1.0:
        w, h = int(BASE_W * scale) // 2 * 2, int(BASE_H * scale) // 2 * 2
        extra = ["-vf", f"scale={w}:{h}"]
    subprocess.run(
        [FFMPEG, "-y", "-framerate", str(fps), "-i", str(png_dir / "f%04d.png"),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
         "-pix_fmt", "yuv420p", "-movflags", "faststart", *extra, out],
        check=True, capture_output=True, text=True)


def run_full(out):
    t0 = time.time()
    scale, fps = 1.0, 30
    n = int(fps * DUR)
    d = TMP_DIR / "frames_full"
    d.mkdir(parents=True, exist_ok=True)
    bg = background(scale)
    for i in range(n):
        frame(i / fps, scale, bg).save(d / f"f{i:04d}.png")
    encode(d, fps, out, crf=22)
    for f in d.glob("*.png"):
        f.unlink()
    d.rmdir()
    print(f"full  : {n} frames @1080x1920 -> {out}  ({time.time()-t0:.1f}s)")


def run_preview(out, sheet, fps=15, scale=0.25, n_sheet=12):
    t0 = time.time()
    n = int(fps * DUR)
    d = TMP_DIR / "frames_draft"
    d.mkdir(parents=True, exist_ok=True)
    bg = background(scale)
    for i in range(n):
        frame(i / fps, scale, bg).save(d / f"f{i:04d}.png")
    encode(d, fps, out, crf=30, scale=scale)
    for f in d.glob("*.png"):
        f.unlink()
    d.rmdir()

    tile_w, tile_h = int(BASE_W * scale), int(BASE_H * scale)
    cols = 4
    rows = math.ceil(n_sheet / cols)
    grid = Image.new("RGB", (tile_w * cols, tile_h * rows), (0, 0, 0))
    bg = background(scale)
    for j in range(n_sheet):
        t = DUR * j / (n_sheet - 1)
        grid.paste(frame(t, scale, bg),
                   ((j % cols) * tile_w, (j // cols) * tile_h))
    sheet.parent.mkdir(exist_ok=True)
    grid.save(sheet)
    print(f"preview: draft mp4 -> {out}\n         contact sheet ({n_sheet} frames) -> {sheet}  "
          f"({time.time()-t0:.1f}s)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--sheet", default=None)
    a = ap.parse_args()
    if a.preview:
        run_preview(a.out or str(OUT_DIR / "ui_demo_draft.mp4"),
                    Path(a.sheet or TMP_DIR / "ui_sheet_draft.png"))
    else:
        run_full(a.out or str(OUT_DIR / "ui_demo.mp4"))
