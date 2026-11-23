# PICO — Immersive Landing Page

コーヒーブランド「PICO」の没入型ワンページサイト。リポジトリ
`kakasoma2ndminecraft-lab/For-Instinct-and-MistralCode` の実素材をすべて
`assets/` に組み込んだ自己完結ビルド（外部のリポジトリ参照なし）。

## 実行

`index.html` をブラウザで直接開くか、任意の静的サーバーで配信:

```bash
cd pico-landing
python3 -m http.server 8000
# http://localhost:8000
```

## 構成

| セクション | 内容 |
| --- | --- |
| Opening | 第一フレームが全画面、中央に PICO メタリックロゴ＋キャッチコピー「最高のコーヒー。最高のひととき。」（ロゴとともにフェード）。中盤のシーン別テキストオーバーレイは廃止し、ヒーロー区間のテキストはこのコピーのみ |
| Scroll-Scrub | スクロール量に応じて事前抽出フレーム（101枚）を差し替えてスクラブ。ラストはラテアートのカップのフレームで終わる |
| Collection | 白背景の商品パッケージを中央に巨大表示。左右に前/次商品を半透明で小さく。矢印（← → キー・スワイプ対応）で入れ替わるカルーセル |
| Story | 豆・抽出・カップの画像によるパララックス・スクロールストーリー |

## 素材対応表（実素材 → ビルド成果物）

| 元ファイル（リポジトリ） | 組み込み先 |
| --- | --- |
| `名称未設定のデザイン.mp4`（4K 60fps/15s、0–5.08s のみ実内容、5.10s以降は抽出アップに切替） | `assets/img/frames/f0001.webp`–`f0101.webp`（1080p/5.05s を **20fps=101枚** に事前抽出、WebP q65、合計4.5MB。最終フレーム＝ラテアートのカップ、実フレーム確認済み。動画ファイルは削除済み、生成素材は不使用） |
| `黒背景に輝く金属文字「PICO」.png` | `assets/img/PICO-metal.png`（1400×788、輝度→アルファで黑背景を透過化。blend不使用） |
| `PICO.png` | `assets/img/PICO.png`（favicon用 256×256） |
| `SOL BRAZIL.jpg` / `dreamina-…-9976`（SOL BRAZIL・白背景） | `assets/img/products/brazil.jpg` |
| `dreamina-…-3966`（NOIR SUMATRA・白背景） | `assets/img/products/sumatra.jpg` |
| `dreamina-…-9366`（ÉQUILIBRE JAMAICA BLUE MOUNTAIN・白背景） | `assets/img/products/jamaica.jpg` |
| `dreamina-…-3982`（SOL MELLOW COLOMBIA・白背景） | `assets/img/products/colombia.jpg` |
| `dreamina-…-4098`（木のスコップと豆） | `assets/img/story/beans.jpg` |
| 動画 3.0s フレーム（滴がカップに落ちる瞬間） | `assets/img/story/extraction.jpg` |
| 動画 4.8s フレーム（ラテアートのカップ） | `assets/img/story/cup.jpg` |

商品画像はすべて画像背景が白のもののみ使用（黑背景の dreamina シリーズは
ストーリー/ヒーロー用途で不使用）。

## 実装メモ

- スクラブ: `scroll` → rAF でフレーム番号を補間（lerp 0.12）し `img.src` を差し替え。iOS Safari は 元動画のキーフレームが1個しかなく `currentTime` シークのたび先頭からデコードが走るため、フレーム事前抽出方式に変更。1枚目は HTML 直書きで即表示、残りは load 後に2並列でプリロード。
- フレーム再生成コマンド:
```sh
ffmpeg -i 名称未設定のデザイン.mp4 -t 5.05 \
  -vf "fps=20,scale=1920:1080" -c:v libwebp -q:v 65 -an \
  assets/img/frames/f%04d.webp
```
  `preload="auto"` + moov 前置（faststart）で即時シーク可能。
- `prefers-reduced-motion` 対応: スクラブ・パララックス無効化。
- フォント: Google Fonts（Cormorant Garamond / Jost / Zen Old Mincho）。
  オフライン時はシステム serif/sans にフォールバック。

## 最適化・アクセシビリティ

- 画像: 商品はJPEG q88（900×1200)、ストーリーはq82（1920px/1200px）に最適化。
  合計約 4.1MB → 約 2.4MB。すべて `width`/`height` 付きで CLS 抑制。
- フレーム: 1920×1080 WebP q65 ×101枚 合計 4.5MB（動画1.6MBと入れ替え）。
- アニメーション: スロット切替の duration (0.85s) と役割入替え゛ (0.86s) を整合。
- a11y: 左右の被闓スロットは `aria-hidden`、更新メタは `aria-live="polite"`、キーボード操作用 `:focus-visible` を nav/CTA/arrow/footer に付与。
