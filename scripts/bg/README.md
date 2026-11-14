# Shiva background (v4.1.2)

Source: `shiva-bg-final.png` (981×1603). Darkened (brightness 0.65, contrast 1.03 baked in) and saved as
`public/media/bg/shiva-bg-720.webp` (720×1177) and `shiva-bg-981.webp` (981×1603).
The motion is pure CSS (`.shiva-pan` in `src/index.css`): transform-only pan head → heart chakra → head, scale ≤ 1.15, 46 s.

The old video loop (VP9 Profile 1 / gbrp 4:4:4 WebM) was removed: Android hardware decoders render it as colour streaks.
