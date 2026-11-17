from pathlib import Path

from PIL import Image

src = Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\resources\icon-only.png')
img = Image.open(src).convert('RGBA')
pixels = img.load()
w, h = img.size
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r > 245 and g > 245 and b > 245:
            pixels[x, y] = (r, g, b, 0)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

pad = int(max(img.size) * 0.08)
side = max(img.size) + pad * 2
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
ox = (side - img.size[0]) // 2
oy = (side - img.size[1]) // 2
canvas.paste(img, (ox, oy), img)

boot = canvas.resize((256, 256), Image.Resampling.LANCZOS)
fav = canvas.resize((192, 192), Image.Resampling.LANCZOS)

targets_boot = [
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\public\boot-logo.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\src\boot-logo.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\android\app\src\main\res\drawable\boot_logo.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\dist\browser\boot-logo.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\android\app\src\main\assets\public\boot-logo.png'),
]
targets_fav = [
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\public\favicon.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\src\favicon.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\dist\browser\favicon.png'),
    Path(r'c:\PROJETOS\NEST_ANGULAR\mobile\android\app\src\main\assets\public\favicon.png'),
]

for path in targets_boot:
    path.parent.mkdir(parents=True, exist_ok=True)
    boot.save(path, 'PNG', optimize=True)
    print(f'boot {path} {path.stat().st_size}')

for path in targets_fav:
    path.parent.mkdir(parents=True, exist_ok=True)
    fav.save(path, 'PNG', optimize=True)
    print(f'fav {path} {path.stat().st_size}')

print('done')
