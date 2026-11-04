"""Composes Play-Store screenshots (1320x2868) from raw app captures.
Usage: python3 scripts/compose-store-shots.py <folder with 1-discover.png ... 8-premium.png>"""
import glob, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1] if len(sys.argv) > 1 else 'store/raw'
W, H = 1320, 2868
F = '/usr/share/fonts/opentype/inter/'
big = ImageFont.truetype(F + 'InterDisplay-ExtraBold.otf', 100)
small = ImageFont.truetype(F + 'InterDisplay-Medium.otf', 46)
small2 = ImageFont.truetype(F + 'InterDisplay-Medium.otf', 40)
TAB = {'1-discover', '2-why', '3-comment', '4-likes', '7-friends'}  # web build shows tabs on top; cut them off
ITEMS = [
    ('1-discover', 'Dein bestes Match\ndes Tages zuerst', 'Daily Spark – jeden Tag neu für dich ausgewählt'),
    ('2-why', 'Sieh, warum\nihr passt', 'Match-Score mit Gründen statt Bauchgefühl'),
    ('3-comment', 'Reagiere auf das,\nwas dich anspricht', 'Auf ein Foto oder eine Antwort – mit Kommentar'),
    ('4-likes', 'Sieh kostenlos,\nwer dich mag', 'Like zurück – und es funkt'),
    ('5-match', 'Es funkt!', 'Gegenseitig gemocht? Dann seid ihr ein Match'),
    ('6-chat', 'Nie wieder\nnur „Hey“', 'Gesprächsstarter aus euren Gemeinsamkeiten'),
    ('7-friends', 'Auch für\nneue Freunde', 'Dating oder Freundschaft – oder beides'),
    ('8-premium', 'Mehr Funken.\nMehr Matches.', 'Matchwerk+ und VIP – schon ab 5,83 € im Monat'),
]
top, bot = (0x3A, 0x13, 0x56), (0x16, 0x06, 0x20)
g = Image.new('RGB', (1, 256))
for y in range(256):
    g.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * y / 255) for i in range(3)))
G = g.resize((W, H))
logo = Image.open('assets/brand/logo-mark.png').convert('RGBA').resize((150, 150), Image.LANCZOS)
for i, (n, head, sub) in enumerate(ITEMS, 1):
    bg = G.copy().convert('RGBA')
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((W // 2 - 520, 120, W // 2 + 520, 900), fill=(238, 58, 106, 70))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    bg.alpha_composite(logo, ((W - 150) // 2, 90))
    d = ImageDraw.Draw(bg)
    y = 270
    for line in head.split('\n'):
        w = d.textlength(line, font=big)
        d.text(((W - w) / 2, y), line, font=big, fill=(255, 241, 220))
        y += 118
    y += 16
    f = small if d.textlength(sub, font=small) <= W - 140 else small2
    d.text(((W - d.textlength(sub, font=f)) / 2, y), sub, font=f, fill=(233, 213, 245))
    shot = Image.open(f'{SRC}/{n}.png').convert('RGB')
    if n in TAB:
        shot = shot.crop((0, 156, W, H))
    t = y + 100
    scale = min((H - t - 110) / shot.height, 0.80 * W / shot.width)
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x = (W - sw) // 2
    s = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((x - 6, t + 24, x + sw + 6, t + sh + 30), radius=70, fill=(0, 0, 0, 140))
    bg.alpha_composite(s.filter(ImageFilter.GaussianBlur(34)))
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(fr).rounded_rectangle((x - 14, t - 14, x + sw + 14, t + sh + 14), radius=78, fill=(12, 6, 16, 255))
    bg.alpha_composite(fr)
    m = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw, sh), radius=64, fill=255)
    bg.paste(shot, (x, t), m)
    bg.convert('RGB').save(f'store/screenshots/phone/{i:02d}-{n.split("-", 1)[1]}.png')
fs = sorted(glob.glob('store/screenshots/phone/*.png'))
ov = Image.new('RGB', (len(fs) * 300, 652), (255, 255, 255))
for k, f in enumerate(fs):
    ov.paste(Image.open(f).resize((300, 652)), (k * 300, 0))
ov.save('store/screenshots/overview.png')
print(len(fs), 'screenshots')
