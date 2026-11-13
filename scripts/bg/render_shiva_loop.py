import sys, math, subprocess
from PIL import Image
src=Image.open('dark.png'); W,H=src.size  # 981x1603
OW,OH=608,1080; FPS=30; T=22.0; N=int(T*FPS)
HEAD_Y=0.30*H; HEART_Y=0.555*H; CX=0.485*W
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{OW}x{OH}','-r',str(FPS),'-i','-','-c:v','ffv1','frames.mkv'],stdin=subprocess.PIPE)
base_h=H  # 9:16 window at scale 1 = full height
for i in range(N):
    p=(1-math.cos(2*math.pi*i/N))/2          # 0→1→0, sine-eased, periodic
    s=1.15+0.20*p
    wh=base_h/s; ww=wh*OW/OH
    cy=HEAD_Y+(HEART_Y-HEAD_Y)*p
    cy=min(max(cy,wh/2),H-wh/2); cx=min(max(CX,ww/2),W-ww/2)
    box=(cx-ww/2,cy-wh/2,cx+ww/2,cy+wh/2)
    ff.stdin.write(src.resize((OW,OH),Image.LANCZOS,box=box).tobytes())
ff.stdin.close(); ff.wait(); print('frames',N)
