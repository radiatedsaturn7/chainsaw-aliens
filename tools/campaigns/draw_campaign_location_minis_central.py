"""Generate transparent regional-map miniature locations for central hubs 5–8.

Usage: python tools/campaigns/draw_campaign_location_minis_central.py --menu 'data/server-storage/files/menus/Game Menu/document.json' --output /tmp/central
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw

from draw_campaign_2994_central_details import MOTIFS, draw_motif

REGIONS = {
    5: 'ozarks',
    6: 'data-center-city',
    7: 'route-66',
    8: 'pikes-peak',
}
TILE_SIZE = (192, 160)
ANCHOR = (96, 112)
NATIVE_TILE_SIZE = (48, 40)
NATIVE_ANCHOR = (24, 28)


def read_menu(raw):
    data = json.loads(raw)
    if data.get('__chainsawStorage') == 'compact-v1':
        return json.loads(gzip.decompress(base64.b64decode(data['data'])))
    return data


def draw_sprite(region, motif):
    """Draw at 1/4 scale then enlarge without softening the game's pixel edges."""
    tile = Image.new('RGBA', NATIVE_TILE_SIZE)
    draw_motif(tile, region, motif, *NATIVE_ANCHOR, is_sprite=True)
    return tile.resize(TILE_SIZE, Image.Resampling.NEAREST)


def generate(menu, out):
    raw = menu.read_bytes()
    screens = {s['id']: s for s in read_menu(raw)['screens']}
    out.mkdir(parents=True, exist_ok=True)
    contact = Image.new('RGB', (8 * TILE_SIZE[0], 4 * (TILE_SIZE[1] + 31)), '#222a37')
    captions = ImageDraw.Draw(contact)
    records = {}
    for row, (stage, region) in enumerate(REGIONS.items()):
        screen = screens[f'campaign-hub-{stage}']
        element = next(e for e in screen['elements'] if e.get('property') == 'campaign-path')
        assert element.get('artRef') == f'campaign-map-{region}', screen['id']
        nodes = [node for node in element['nodes'] if node.get('raceRef')]
        assert len(nodes) == len(MOTIFS[region]) == 8
        target = out / 'sprites' / f'{stage:02}-{region}'
        target.mkdir(parents=True, exist_ok=True)
        matched = set()
        saved = []
        for col, node in enumerate(nodes):
            nref = ' '.join(re.findall(r'[A-Za-z0-9.]+', node['raceRef'].lower()))
            choices = {motif for token, motif in MOTIFS[region] if token in nref}
            assert len(choices) == 1, (region, node, choices)
            motif = choices.pop()
            assert motif not in matched, (region, motif)
            matched.add(motif)
            tile = draw_sprite(region, motif)
            rect = tile.getchannel('A').getbbox()
            assert rect and 0 < rect[0] < rect[2] < TILE_SIZE[0] and 0 < rect[1] < rect[3] < TILE_SIZE[1], (region, motif, rect)
            file = target / f'{node["id"]}.png'
            tile.save(file, optimize=True)
            assert tile.getpixel((0, 0))[3] == 0 and tile.getpixel(ANCHOR)[3] > 0, (region, motif)
            x, y = col * TILE_SIZE[0], row * (TILE_SIZE[1] + 31)
            contact.paste(tile, (x, y), tile.getchannel('A'))
            captions.text((x + 6, y + TILE_SIZE[1] + 1), f'{stage:02} / {node["id"]} / {motif}', fill='#e1e9ee')
            captions.text((x + 6, y + TILE_SIZE[1] + 14), node['raceRef'][:27], fill='#a4b3c0')
            saved.append({'id': node['id'], 'raceRef': node['raceRef'], 'motif': motif, 'path': file.relative_to(out).as_posix(),
                          'x': node['x'], 'y': node['y'], 'bbox': rect,
                          'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
        records[region] = {'screenId': screen['id'], 'artRef': element['artRef'], 'sprites': saved}
    receipt = {'menuSha256': hashlib.sha256(raw).hexdigest(), 'tileSize': TILE_SIZE, 'groundAnchor': ANCHOR, 'regions': records}
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    contact.save(out / 'contact.png', optimize=True)
    print(f'Created {sum(len(r["sprites"]) for r in records.values())} sprites from {menu}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--menu', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    generate(args.menu, args.output)
