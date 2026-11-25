---
name: video-preview-loop
description: Fast preview-and-verify loop for code-rendered videos (PIL/ffmpeg -> MP4). Use whenever creating or editing programmatic video - 9:16 shorts, fake-UI animations, timeline edits, kinetic text. Renders a low-res draft plus a 12-frame contact sheet in ~1 second so the agent can SEE how an edit will look before spending time on the full render.
---

# Video Preview Loop

Read a rendered video the cheap way: never iterate on full renders. Verify
every edit on a **contact sheet** (12 evenly-spaced frames tiled into one PNG),
which the agent can read in a single image review, then run the full render
once, on approval.

## Quickstart

```bash
# from any project directory (skill bootstraps ffmpeg + font on first run)
python3 <skill-dir>/scripts/render_ui_short.py --preview
# -> ./out/ui_demo_draft.mp4      (270x480 @15fps, ~19KB, for human skim)
# -> ./tmp/ui_sheet_draft.png     (12 frames, one image for agent review)

# after the sheet is approved
python3 <skill-dir>/scripts/render_ui_short.py
# -> ./out/ui_demo.mp4            (1080x1920 @30fps final)
```

`scripts/render_short.py` renders the same loop from a `timeline.json` EDL.

## The loop

1. Edit the spec (numbers in the render script or timeline JSON).
2. Run `--preview`. Read the contact sheet once; judge every stage:
   layout, overlap, spacing, animation state at that timestamp.
3. Fix numbers, repeat step 2. Each pass is ~1s.
4. ONLY on approval: full render (tens of seconds).
5. Spot-check the final with 2-3 extracted frames, then ship/copy.

## Rules

- Full render is the LAST step, never an iteration tool.
- All layout and motion must be expressible as frame-indexed math
  (easing, stagger intervals, enable windows) so one number edit re-renders
  deterministically.
- The contact sheet must answer both "what happens when" AND
  "is anything broken" (overlap, clipping, missing glyphs).
- One contact sheet per iteration. If 12 sampling points are too sparse for
  a fast animation, sample around the hot region instead of more frames.

## Dependencies (auto-installed on first run)

- `pip install imageio-ffmpeg pillow`
- Noto Sans JP font -> `scripts/bin/NotoSansJP-Bold.otf` (downloaded)

## Extending

- Swap the draw function for a Playwright/GSAP or Remotion renderer; keep the
  `--preview` contract: draft resolution + contact sheet, always < 10s.
- For a `timeline.json`-driven project, keep the EDL as the single source of
  truth; the renderer is a dumb function of the EDL.
