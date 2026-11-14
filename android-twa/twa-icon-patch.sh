#!/bin/bash
# Re-adds themed (monochrome) icon layer + dark adaptive background after `bubblewrap update`.
set -e; cd /workspace/d31-play/twa/app/src/main/res
for d in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do n=${d%%:*}; s=${d##*:}; mkdir -p mipmap-$n
  /home/box/d31tools/venv/bin/python -c "from PIL import Image;Image.open('/workspace/d31-universe-pro/public/icons/monochrome-512.png').resize(($s,$s),Image.LANCZOS).save('mipmap-$n/ic_monochrome.png')"; done
python3 - <<'PY'
p='mipmap-anydpi-v26/ic_launcher.xml';s=open(p).read()
if 'monochrome' not in s:
  s=s.replace('@android:color/white','@color/d31_icon_bg').replace('<foreground android:drawable="@android:color/transparent" />','<foreground android:drawable="@android:color/transparent" />\n    <monochrome android:drawable="@mipmap/ic_monochrome" />')
  open(p,'w').write(s)
open('values/d31_colors.xml','w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="d31_icon_bg">#0B0E13</color></resources>\n')
PY
echo patched
