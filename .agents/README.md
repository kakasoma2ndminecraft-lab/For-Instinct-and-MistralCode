# AI エージェント用スキル（OpenMontage 由来）

OpenMontage のスキル集を、このリポジトリで他の AI エージェント（Claude Code / Codex / Cursor など）から
使えるようにコピーしたものです。

- 取得元: <https://github.com/OpenMontageInc/OpenMontage>
- 取得元コミット: `2e003e65fa99a0f329478a2c1cdcf26bc481933a`（2026-11-15）
- ライセンス: GNU AGPL-3.0 — `OPENMONTAGE-LICENSE` を参照

## 配置

| パス | 内容 |
| --- | --- |
| `.agents/skills/` | スキル本体 93 個（`SKILL.md` + references / examples / templates）。`name` / `description` の frontmatter 付き |
| `.claude/skills` | `.agents/skills` へのシンボリックリンク（Claude Code 用） |
| `.claude/commands/` | スラッシュコマンド `/reel` `/ink-art` `/animated-drawing` `/backlot` |
| `.codex/prompts/` | 上記コマンドの Codex 版（Codex はプロジェクト直下を読まないため、利用時に `~/.codex/prompts/` へコピーする） |

## 含まれていないもの

OpenMontage の制作パイプライン本体（`tools/`、`lib/`、`pipeline_defs/`、`projects/` などの Python 実行環境）と
`AGENT_GUIDE.md` は含めていません。一部のスキルは `tools/` 配下のスクリプトを前提にしているため、
それらを使う場合は OpenMontage リポジトリ側で実行してください。

## 更新方法

取得元の `.agents/skills/` をそのまま上書きコピーしてください。

```sh
git clone --depth 1 https://github.com/OpenMontageInc/OpenMontage.git /tmp/om
cp -a /tmp/om/.agents/skills/. .agents/skills/
cp -a /tmp/om/.claude/commands/. .claude/commands/
cp -a /tmp/om/.codex/prompts/. .codex/prompts/
```
