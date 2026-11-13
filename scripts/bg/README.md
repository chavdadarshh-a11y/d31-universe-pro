Shiva background loop (v4.1). Source: Darshan's `shiva-bg-final.png` only — no other footage.
1. Darken: highlight roll-off `a/(1+0.55a)*1.55`, gamma 1.12, ×0.60, saturation ×0.86, light unsharp (radius 1.2, 60 %) → `dark.png` (also exported as `public/media/shiva.webp` / `shiva-720.webp` static fallback).
2. `python3 render_shiva_loop.py` → 22 s @ 30 fps, 608×1080, sine-eased pan third-eye → heart chakra → back with zoom 1.15 → 1.35 → 1.15, each frame cropped from the full-res image with Lanczos (sub-pixel, no blur). Start = end (seamless).
3. Encode: H.264 2-pass 1150 kb/s veryslow (`shiva-loop.mp4`, ~3.15 MB) + VP9 2-pass 1050 kb/s (`shiva-loop.webm`, ~3.2 MB); poster = frame 0 JPG.
