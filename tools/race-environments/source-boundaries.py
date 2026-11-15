"""Read-only source-art sampling diagnostics, never visual acceptance or image repair."""
import json
import sys
from PIL import Image


def boundary_metrics(image):
    im = image.convert('RGB')
    w, h = im.size
    if w < 2 or h < 2:
        raise ValueError('Need a two-dimensional panorama')
    def row_range(y):
        pixels = [im.getpixel((x, y)) for x in range(w)]
        return [max(p[c] for p in pixels) - min(p[c] for p in pixels) for c in range(3)]
    edge = [sum(abs(a-b) for a,b in zip(im.getpixel((0,y)), im.getpixel((w-1,y))))/3 for y in range(h)]
    top, bottom = row_range(0), row_range(h-1)
    warnings = []
    if sum(edge)/h > 8 or sum(v > 70 for v in edge)/h > .01:
        warnings.append('horizontal-wrap')
    if max(top) > 12:
        warnings.append('top-row-extrusion')
    if max(bottom) > 12:
        warnings.append('bottom-row-extrusion')
    return {'width':w,'height':h,'edgeMeanRGB':sum(edge)/h,'edgeMaximumRGB':max(edge),
            'topRangeRGB':top,'bottomRangeRGB':bottom,'warnings':warnings,
            'scope':'Sampling diagnostics only; flat/blank artwork can pass these metrics. Native projection and human review remain required.'}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Usage: source-boundaries.py IMAGE [IMAGE ...]')
    print(json.dumps([{'path':p,**boundary_metrics(Image.open(p))} for p in sys.argv[1:]],indent=2))
