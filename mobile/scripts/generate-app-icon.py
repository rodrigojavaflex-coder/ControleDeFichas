from PIL import Image, ImageDraw
from pathlib import Path

src_path = Path(
    r"C:\Users\rodrigo.teixeira\.cursor\projects\c-PROJETOS-NEST-ANGULAR\assets\image-1c0773a9-a2d8-4b6e-a1d5-b2f3048f2150.png"
)
res = Path(r"C:\PROJETOS\NEST_ANGULAR\mobile\android\app\src\main\res")
resources = Path(r"C:\PROJETOS\NEST_ANGULAR\mobile\resources")
public = Path(r"C:\PROJETOS\NEST_ANGULAR\mobile\public")
resources.mkdir(parents=True, exist_ok=True)

src = Image.open(src_path).convert("RGBA")


def trim_box(im: Image.Image, threshold: int = 250):
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if r > threshold and g > threshold and b > threshold:
                continue
            found = True
            minx, miny = min(minx, x), min(miny, y)
            maxx, maxy = max(maxx, x), max(maxy, y)
    if not found:
        return im.getbbox() or (0, 0, w, h)
    pad = 8
    return (
        max(0, minx - pad),
        max(0, miny - pad),
        min(w, maxx + 1 + pad),
        min(h, maxy + 1 + pad),
    )


logo = src.crop(trim_box(src))


def fit_on_canvas(
    logo_img: Image.Image,
    size: int,
    scale: float = 0.72,
    bg=(255, 255, 255, 255),
    round_mask: bool = False,
):
    canvas = Image.new("RGBA", (size, size), bg)
    max_side = int(size * scale)
    lw, lh = logo_img.size
    ratio = min(max_side / lw, max_side / lh)
    nw, nh = max(1, int(lw * ratio)), max(1, int(lh * ratio))
    resized = logo_img.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.alpha_composite(resized, (x, y))
    if round_mask:
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0))
        out.putalpha(mask)
        return out
    return canvas


def fit_foreground(logo_img: Image.Image, size: int, scale: float = 0.58):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_side = int(size * scale)
    lw, lh = logo_img.size
    ratio = min(max_side / lw, max_side / lh)
    nw, nh = max(1, int(lw * ratio)), max(1, int(lh * ratio))
    resized = logo_img.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


densities = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

for folder, (launcher, foreground) in densities.items():
    out_dir = res / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = fit_on_canvas(logo, launcher, scale=0.78, bg=(255, 255, 255, 255))
    round_icon = fit_on_canvas(
        logo, launcher, scale=0.72, bg=(255, 255, 255, 255), round_mask=True
    )
    fg = fit_foreground(logo, foreground, scale=0.58)
    icon.save(out_dir / "ic_launcher.png", "PNG")
    round_icon.save(out_dir / "ic_launcher_round.png", "PNG")
    fg.save(out_dir / "ic_launcher_foreground.png", "PNG")
    print(f"ok {folder}: {launcher}/{foreground}")

master = fit_on_canvas(logo, 1024, scale=0.78, bg=(255, 255, 255, 255))
master.save(resources / "icon.png", "PNG")
master.save(resources / "icon-only.png", "PNG")
fav = fit_on_canvas(logo, 192, scale=0.8, bg=(255, 255, 255, 255))
fav.save(public / "favicon.png", "PNG")
print("resources/icon.png e public/favicon.png gerados")
