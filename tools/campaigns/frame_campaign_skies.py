"""Raise saved campaign panoramas; keep custom framing and scene lighting intact.

Run after importing/re-dressing races. Uses existing Race Editor settings only.
"""
from audit_race_lines import ROOT, read, write


def frame(race):
    settings = race.get('skyboxSettings', {})
    ref = race.get('skyboxArtRef') or settings.get('artRef', '')
    if not ref.startswith('skybox-'):
        return
    # A tenth of the viewport reveals the scenery below the image's sky-heavy
    # upper half. Negative is upward; retain explicitly authored custom offsets.
    if not settings.get('offsetYRatio'):
        race['skyboxSettings'] = {**settings, 'offsetYRatio': -0.1}
    if race.get('name') == 'Tower Hill Road':
        race['visualFx'] = {**race.get('visualFx', {}), 'skyBrightness': 0.3}


if __name__ == '__main__':
    changed = 0
    for path in (ROOT / 'races').glob('*/document.json'):
        doc = read(path)
        race = doc.get('race', {})
        before = repr(race)
        frame(race)
        if repr(race) != before:
            write(path, doc)
            changed += 1
    print(f'Updated {changed} saved race skyboxes.')
