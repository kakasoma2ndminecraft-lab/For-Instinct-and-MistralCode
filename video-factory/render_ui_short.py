#!/usr/bin/env python3
"""Fake SaaS UI short: 1080x1920, 30fps, deterministic frame-by-frame render.

Reproduces the "AI app UI animation" short style:
file cards stagger in, progress fills, statuses flip to done, result card pops.
"""
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = str(ROOT / "bin" / "ffmpeg")
FONT = str(ROOT / "bin" / "NotoSansJP-Bold.otf")

W, H, FPS, DUR = 1080, 1920, 30, 7.0
N = int(W * H * FPS * DUR / (W * H))  # frames = fps*dur
N = int(FPS * DUR)

BG_TOP = (11, 16, 38)
BG_BOT = (30, 58, 138)
CARD = (255, 255, 255, 255)
TXT_DARK = (20, 27, 45)
TXT_GRAY = (120, 132, 155)

CARDS = [
    {"name": "sales_deck.pdf", "icon": (236, 72, 153), "glyph": "PDF",
     "in": 0.35, "done": 2.1},
    {"name": "annual_report.xlsx", "icon": (34, 197, 94), "glyph": "XLS",
     "in": 0.75, "done": 2.9},
    {"name": "consult_notes.doc", "icon": (59, 130, 246), "glyph": "DOC",
     "in": 1.15, "done": 3.7},
]
RESULT_AT = 4.3


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_out_back(t, s=1.7):
    t -= 1
    return 1 + (t * t * ((s + 1) * t + s))


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def lerp(a, b, t):
    return a + (b - a) * t


def draw_background(t):
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(0, H, 4):
        row = mix(BG_TOP, BG_BOT, y / H)
        for yy in range(y, min(y + 4, H)):
            d = ImageDraw.Draw(img)
            d.line([(0, yy), (W, yy)], fill=row)
    return img.convert("RGBA")


def rounded_card(size, radius, fill):
    w, h = size
    m = Image.new("RGBA", (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([4, 4, 4 + w, 4 + h], radius=radius, fill=fill)
    return m.filter(ImageFilter.GaussianBlur(0.5))


def draw_frame(idx, bg_cache):
    t = idx / FPS
    img = bg_cache.copy().convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    title_a = ease_out_cubic(min(max((t - 0.05) / 0.5, 0), 1))
    title_y = int(lerp(330, 300, title_a))
    d.text((W // 2, title_y), "AI File Analyzer", font=_font("Bold", 84),
           anchor="mm", fill=(255, 255, 255, int(255 * title_a)))
    if title_a > 0.99:
        pass
    sub_y = title_y + 90
    d.text((W // 2, sub_y), "Vision-powered document intelligence",
           font=_font("Bold", 36), anchor="mm",
           fill=(160, 178, 210, int(230 * title_a)))

    card_w, card_h = 840, 150
    x0 = (W - card_w) // 2
    for i, c in enumerate(CARDS):
        y_top = 560 + i * 210
        a_in = ease_out_back(min(max((t - c["in"]) / 0.55, 0), 1))
        if a_in <= 0:
            continue
        dy = int(lerp(70, 0, a_in))
        ca = int(255 * min(max((t - c["in"]) / 0.35, 0), 1))
        layer = rounded_card((card_w, card_h), 28, (255, 255, 255, ca))
        cx, cy = x0 - 4, y_top + dy - 4
        ov.alpha_composite(layer, (cx, cy))
        d = ImageDraw.Draw(ov)
        ix, iy = cx + 34, cy + 33
        iw = 84
        d.rounded_rectangle([ix, iy, ix + iw, iy + iw], radius=18,
                            fill=c["icon"] + (ca,))
        d.text((ix + iw / 2, iy + iw / 2), c["glyph"], font=_font("Bold", 26),
               anchor="mm", fill=(255, 255, 255, ca))
        tx = ix + iw + 30
        d.text((tx, iy + 28), c["name"], font=_font("Bold", 40),
               anchor="lm", fill=TXT_DARK + (ca,))

        done_t = t >= c["done"]
        if done_t:
            status = "Done"
            col = (34, 197, 94)
        else:
            dots = "." * (1 + int(t * 3) % 3)
            status = f"Analyzing{dots}"
            col = TXT_GRAY
        d.text((tx, iy + 82), status, font=_font("Bold", 30), anchor="lm",
               fill=col + (ca,))

        bar_y = iy + iw + 14
        prog = min(max((t - c["in"] - 0.3) / (c["done"] - c["in"] - 0.3), 0), 1)
        if done_t:
            prog = 1.0
        d.rounded_rectangle([tx, bar_y, tx + 560, bar_y + 10], radius=5,
                            fill=(228, 233, 242, ca))
        if prog > 0:
            d.rounded_rectangle([tx, bar_y, tx + int(560 * prog), bar_y + 10],
                                radius=5, fill=c["icon"] + (ca,))

    ra = ease_out_back(min(max((t - RESULT_AT) / 0.6, 0), 1))
    if ra > 0:
        rh = 300
        ry = int(lerp(620, 560, ra))
        layer = rounded_card((840, rh), 32, (255, 255, 255, int(255 * ra)))
        ov.alpha_composite(layer, ((W - 840) // 2, ry))
        d = ImageDraw.Draw(ov)
        d.text((W // 2, ry + 70), "Summary Ready", font=_font("Bold", 52),
               anchor="mm", fill=TXT_DARK + (int(255 * ra),))
        rows = [("3 files processed", "0.9s"), ("Insights extracted", "12"),
                ("Confidence", "97.4%")]
        for j, (k, v) in enumerate(rows):
            yy = ry + 150 + j * 46
            d.text((W // 2 - 350, yy), k, font=_font("Bold", 30), anchor="lm",
                   fill=TXT_GRAY + (int(255 * ra),))
            d.text((W // 2 + 350, yy), v, font=_font("Bold", 30), anchor="rm",
                   fill=TXT_DARK + (int(255 * ra),))

    if t > 0.8:
        sh = (math.sin(t * 2.2) + 1) / 2
        d = ImageDraw.Draw(ov)
        d.ellipse([W // 2 - 9, H - 250 - 9, W // 2 + 9, H - 250 + 9],
                  fill=(120, 200, 255, int(40 + 60 * sh)))

    return Image.alpha_composite(img, ov).convert("RGB")


_fonts = {}


def _font(weight, size):
    from PIL import ImageFont
    key = size
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT, size)
    return _fonts[key]


def main():
    out_dir = ROOT / "tmp" / "frames"
    out_dir.mkdir(parents=True, exist_ok=True)
    bg = draw_background(0)
    paths = []
    for i in range(N):
        fr = draw_frame(i, bg)
        p = out_dir / f"f{i:04d}.png"
        fr.save(p)
        paths.append(p)
    out = str(ROOT / "out" / "ui_demo.mp4")
    Path(out).parent.mkdir(exist_ok=True)
    subprocess.run(
        [FFMPEG, "-y", "-framerate", str(FPS), "-i", str(out_dir / "f%04d.png"),
         "-c:v", "libx264", "-preset", "medium", "-crf", "22",
         "-pix_fmt", "yuv420p", "-movflags", "faststart", out],
        check=True, capture_output=True, text=True)
    for p in paths:
        p.unlink()
    out_dir.rmdir()
    probe = subprocess.run([FFMPEG, "-hide_banner", "-i", out],
                           capture_output=True, text=True)
    for line in probe.stderr.splitlines():
        if "Duration" in line or "Video" in line:
            print(line.strip())


if __name__ == "__main__":
    main()
