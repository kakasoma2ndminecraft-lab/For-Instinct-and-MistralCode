# video-factory

Code-rendered video demos (agent-made, deterministic).

## Watching

- `ui_demo.mp4` - fake SaaS UI animation (7s, 9:16) with preview loop
- `ui_demo_draft.mp4` - low-res draft used during iteration
- `short.mp4` - timeline.json -> MP4 demo (5s, 9:16)
- `contact-sheet.png` - 12-frame agent-review image (the core of the preview skill)

## Skill

`.claude/skills/video-preview-loop/` is a portable agent skill (SKILL.md +
self-bootstrapping renderers). Drop it into any project's `.claude/skills/`,
then `--preview` for fast iteration and full render on approval.
