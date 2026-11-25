# Skill: video preview loop (fast visual iteration)

Purpose: let the editing agent verify *how the screen will look* cheaply,
before spending time on a full render. Speed comes from two mechanisms:

1. Draft resolution + frame rate (`--preview`): 270x480 @15fps instead of
   1080x1920 @30fps. ~4x fewer pixels, half the frames.
2. Contact sheet: 12 evenly-spaced frames tiled into ONE PNG. The agent sees
   the whole video in a single image read, not 12 separate reads.

## The loop (never break it)

1. Edit the spec (numbers in the render script / timeline JSON).
2. Run `python3 scripts/render_ui_short.py --preview`
   -> `out/ui_demo_draft.mp4` (human skim) + `tmp/ui_sheet_draft.png` (agent read).
3. Read the contact sheet image, judge each stage:
   layout, overlap, spacing, animation state at that timestamp.
4. Fix numbers. Go to 2. Repeat until approved.
5. ONLY on approval: run `python3 scripts/render_ui_short.py` (full render).
6. Spot check the final: extract 2-3 frames, verify, ship.

## Rules

- Never use full-res frames for iteration judgement. Full render is the LAST step.
- Time budget expectation: preview pass well under 10s; full render tens of seconds.
- Keep the timeline/EDL as the single source of truth. Numbers in, picture out.
- Every layout/anim decision should be expressible as frame-indexed math
  (easing, stagger, enable windows), not manual drawing.
- When adding a new scene type: extend the spec first, then preview, then render.

## Scaling to other recipe types

The same loop applies to any deterministic renderer (PIL here; Playwright+GSAP
or Remotion later). The contract is: `render --preview` must ALWAYS be cheaper
than reading the video, and the output must fit ONE image for agent review.
