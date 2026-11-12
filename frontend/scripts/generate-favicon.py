from PIL import Image
from pathlib import Path
import base64
import io

src_path = Path(
    r"C:\Users\rodrigo.teixeira\.cursor\projects\c-PROJETOS-NEST-ANGULAR\assets\image-1c0773a9-a2d8-4b6e-a1d5-b2f3048f2150.png"
)
out = Path(r"C:\PROJETOS\NEST_ANGULAR\frontend\public")
out.mkdir(parents=True, exist_ok=True)

src = Image.open(src_path).convert("RGBA")
px = src.load()
w, h = src.size
minx, miny, maxx, maxy = w, h, 0, 0
found = False
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 20 or (r > 250 and g > 250 and b > 250):
            continue
        found = True
        minx, miny = min(minx, x), min(miny, y)
        maxx, maxy = max(maxx, x), max(maxy, y)

if found:
    box = (max(0, minx - 2), max(0, miny - 2), min(w, maxx + 3), min(h, maxy + 3))
else:
    box = (0, 0, w, h)

logo = src.crop(box)


def fit(size: int, scale: float = 1.0, bg=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (size, size), bg)
    max_side = int(size * scale)
    lw, lh = logo.size
    ratio = min(max_side / lw, max_side / lh)
    nw, nh = max(1, int(lw * ratio)), max(1, int(lh * ratio))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def make_logo_transparent(im: Image.Image, threshold: int = 245) -> Image.Image:
    """Remove fundo branco residual da arte original."""
    out_im = im.copy()
    px = out_im.load()
    w, h = out_im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                px[x, y] = (r, g, b, 0)
                continue
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (r, g, b, 0)
    return out_im


logo = make_logo_transparent(logo)

fit(32).save(out / "favicon.png", "PNG")
fit(64).save(out / "favicon-64.png", "PNG")
fit(192).save(out / "favicon-192.png", "PNG")

icos = [fit(s) for s in (16, 32, 48)]
icos[0].save(
    out / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=icos[1:],
)

# SVG com PNG embutido (fundo transparente)
size = 256
svg_img = fit(size, scale=1.0)
buf = io.BytesIO()
svg_img.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode("ascii")
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
    f'<image href="data:image/png;base64,{b64}" width="{size}" height="{size}"/>'
    f"</svg>\n"
)
(out / "favicon.svg").write_text(svg, encoding="utf-8")
print("favicon.png, favicon.ico, favicon.svg e favicon-192.png gerados (fundo transparente)")
