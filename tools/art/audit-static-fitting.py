#!/usr/bin/env python3
"""Read-only audit of canonical offline fitting evidence (not a visual/gameplay test).

Usage: python tools/art/audit-static-fitting.py [--repo PATH] [--output REPORT.json]
Exit 1 means invalid/stale evidence; an absent or explicitly pending review is not
an error and is never counted as static acceptance. No car files are modified.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

SLOTS = ['front', 'frontRight', 'right', 'rearRight', 'rear', 'rearLeft', 'left', 'frontLeft']
SIZES = {(1280, 720), (390, 844)}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def within(folder, value):
    p = Path(value)
    p = (p if p.is_absolute() else folder / p).resolve()
    require(p.is_relative_to(folder.resolve()), f'Artifact escapes car folder: {value}')
    return p


def decoded(path):
    doc = read(path)
    if doc.get('__chainsawStorage'):
        doc = json.loads(gzip.decompress(base64.b64decode(doc['data'])))
    return doc


def optional_hash(obj, keys, expected, label):
    for key in keys:
        if key in obj:
            require(obj[key] == expected, f'Stale {label}: {key}')


def backing_check(cfg, overlay):
    """Numeric.background is ignored by native CarGauges; require real backing."""
    widgets = overlay['art']['gauges']['interior']['widgets']
    numbers = [w for w in widgets if w.get('enabled', True) and w.get('showValue', True)
               and w.get('format') == 'number']
    requested = cfg.get('cockpitCalibration', {}).get('gaugeBackground')
    ignored = [w for w in numbers if w.get('background') not in
               (None, '', 'transparent', 'rgba(0,0,0,0)', '#00000000')]
    if not requested and not ignored:
        return 'not-requested'
    require(numbers, 'Gauge backing requested without numeric instruments')
    x = min(w['x'] for w in numbers)
    y = min(w['y'] for w in numbers)
    right = max(w['x'] + w['width'] for w in numbers)
    bottom = max(w['y'] + w['height'] for w in numbers)
    first_number = min(widgets.index(w) for w in numbers)
    valid = []
    for w in widgets[:first_number]:
        color = w.get('color', '')
        opaque = isinstance(color, str) and color.startswith('#') and (
            len(color) == 7 or (len(color) == 9 and color[-2:].lower() == 'ff'))
        if (w.get('enabled', True) and w.get('opacity', 1) >= 1 and w.get('source') == 'decoration'
                and w.get('format') == 'icon' and w.get('showValue') is False
                and not w.get('artRef') and not w.get('textTemplate') and opaque
                and (not requested or color.lower() == requested.lower())
                and w.get('x', 1) <= x + 1e-6 and w.get('y', 1) <= y + 1e-6
                and w.get('x', 0) + w.get('width', 0) >= right - 1e-6
                and w.get('y', 0) + w.get('height', 0) >= bottom - 1e-6):
            valid.append(w)
    require(valid, 'Numeric background is ignored: missing opaque native decoration backing before numbers')
    return 'native-decoration-verified'


def review_claim(review):
    scope = ' '.join(str(review.get(k, '')) for k in ['scope', 'fittingScope', 'acceptanceScope']).lower()
    claim = review.get('staticNativeFit') is True or (review.get('runtimeFitted') is True and 'static' in scope)
    holds = any(review.get(k) for k in ['holds', 'knownBlockingStaticDefects', 'visualHold', 'sourceReviewRequired', 'pending'])
    desktop = review.get('desktopStaticFit') is True
    mobile = review.get('mobileStaticFit') is True or review.get('portraitStaticFit') is True
    angles = next((review[k] for k in ['viewsReviewed', 'exteriorAnglesReviewed', 'reviewedExteriorSlots'] if k in review), [])
    sizes = next((review[k] for k in ['viewportSizes', 'cockpitViewportsReviewed', 'reviewedCockpitSizes'] if k in review), [])
    return claim and not holds and desktop and mobile and set(angles) == set(SLOTS) and set(map(tuple, sizes)) == SIZES


def audit_prepared(root, folder):
    bundle = folder / 'runtime-prepared'
    status = read(bundle / 'runtime-preparation.json')
    cfg_path = folder / 'fitting-config.json'
    cfg, overlay = read(cfg_path), read(bundle / 'art-overlay.json')
    source, manifest = read(folder / 'package-status.json'), read(bundle / 'manifest-delta.json')
    ident = folder.name
    require(status['id'] == cfg['id'] == overlay['id'] == source['id'] == ident, 'Identity mismatch')
    require(status['fittingConfigSha256'] == sha(cfg_path), 'Stale fitting config')
    require(status['sourceHashes'] == source['sourceHashes'] == cfg['sourceHashes'], 'Source hash records disagree')
    require(set(source['sourceHashes']) == {'body', 'dashboard', 'tires'}, 'Unexpected source roles')
    for role, digest in source['sourceHashes'].items():
        require(sha(folder / (role + '.png')) == digest, f'Stale source: {role}')
    require(not cfg.get('visualHold') and not read(folder / 'package-config.json').get('visualHold'), 'Source is held')
    require(status['productionIntegrated'] is False and status['gameplayAccepted'] is False
            and status['nonArtFieldsPreserved'] is True, 'Prepared scope/preservation flags invalid')
    require(set(manifest) == {'folders'} and set(manifest['folders']) == {'art'}, 'Manifest includes non-art changes')
    refs = {f'catalog-{ident}-{role}' for role in ['body', 'dashboard', 'tires']}
    require(set(manifest['folders']['art']) == refs == set(status['nativeHashes']), 'Own native references mismatch')
    for ref, digest in status['nativeHashes'].items():
        native = within(bundle, manifest['folders']['art'][ref])
        require(sha(native) == digest, f'Stale native document: {ref}')
        decoded(native)
    doc = root / 'data/server-storage/files/cars' / cfg['name'] / 'document.json'
    require(doc.resolve().is_relative_to((root / 'data/server-storage/files/cars').resolve()), 'Invalid car name path')
    digest = sha(doc)
    require(digest == status['inputDocumentSha256'] == overlay['expectedDocumentSha256'] == cfg['expectedDocumentSha256'], 'Stale input document')
    require(status['rosterCommit'] == cfg['rosterCommit'] == overlay['rosterCommit'], 'Roster commit mismatch')
    pinned = subprocess.check_output(['git', 'show', cfg['rosterCommit'] + ':' + str(doc.relative_to(root))], cwd=root)
    require(hashlib.sha256(pinned).hexdigest() == digest, 'Current input differs from pinned commit')
    car = decoded(doc)['car']
    require(car['id'] == ident and car['name'] == cfg['name'] == overlay['name'], 'Input document identity mismatch')
    return cfg, status, overlay, digest


def audit_review(root, folder, review_path, cfg, status, overlay, input_hash):
    review = read(review_path)
    require(review['id'] == folder.name, 'Review identity mismatch')
    require(review.get('gameplayAccepted', False) is False and review.get('productionIntegrated', False) is False,
            'Static review claims gameplay/production acceptance')
    for key in ['selectedBundle', 'bundle']:
        if key in review:
            require(within(folder, review[key]) == folder / 'runtime-prepared', 'Review points to noncanonical bundle')
    render_value = review.get('selectedRender') or review.get('render')
    if not render_value and review.get('preview'):
        render_value = str(Path(review['preview']).parent)
    require(render_value, 'No selected render directory in review')
    render_dir = within(folder, render_value)
    report_path = render_dir / 'render-report.json'
    report = read(report_path)
    overlay_hash = sha(folder / 'runtime-prepared/art-overlay.json')
    optional_hash(review, ['fittingConfigSha256', 'fitConfigSha256'], sha(folder / 'fitting-config.json'), 'review config')
    optional_hash(review, ['renderReportSha256'], sha(report_path), 'review render report')
    optional_hash(review, ['overlaySha256'], overlay_hash, 'review overlay')
    optional_hash(review, ['inputDocumentSha256'], input_hash, 'review input')
    optional_hash(review, ['manifestDeltaSha256'], sha(folder / 'runtime-prepared/manifest-delta.json'), 'review manifest')
    optional_hash(review, ['sourceHashes'], status['sourceHashes'], 'review sources')
    optional_hash(review, ['nativeHashes'], status['nativeHashes'], 'review native documents')
    require('renderReportSha256' in review or 'overlaySha256' in review, 'Review lacks hash binding to current render/overlay')
    require(report['id'] == folder.name and report['overlaySha256'] == overlay_hash
            and report['inputDocumentSha256'] == input_hash, 'Stale render input/overlay')
    require(report.get('staticPreviewOnly') is True and report.get('gameplayAccepted') is False
            and report.get('physicsStepped') is False and report.get('productionWrites') == 0, 'Render scope invalid')
    require(set(status['nativeHashes']).issubset(report['nativeHashes']), 'Render missing own native hashes')
    for ref, digest in report['nativeHashes'].items():
        require('/' not in ref and '..' not in ref, 'Invalid render art reference')
        native = folder / 'runtime-prepared/art' / ref / 'document.json'
        if not native.exists():
            native = root / 'data/server-storage/files/art' / ref / 'document.json'
        require(sha(native) == digest, f'Stale rendered native/shared art: {ref}')
        if ref in status['nativeHashes']:
            require(status['nativeHashes'][ref] == digest, f'Render/native hash mismatch: {ref}')
    require(len(report['exterior']) == 8 and {v['slot'] for v in report['exterior']} == set(SLOTS), 'Incomplete native exterior renders')
    require(len(report['cockpit']) == 2 and {tuple(v['viewport']) for v in report['cockpit']} == SIZES, 'Incomplete cockpit renders')
    previews = {}
    names = [f'exterior-{s}.png' for s in SLOTS] + ['cockpit-1280.png', 'cockpit-390.png', 'contact-sheet.png']
    for name in names:
        p = render_dir / name
        require(p.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', f'Missing/invalid preview: {name}')
        previews[name] = sha(p)
    for name, digest in review.get('previewHashes', {}).items():
        require(sha(within(render_dir, name)) == digest, f'Stale review preview: {name}')
    return dict(review=str(review_path.relative_to(root)), render=str(render_dir.relative_to(root)),
                renderReportSha256=sha(report_path), overlaySha256=overlay_hash,
                previewHashes=previews, backing=backing_check(cfg, overlay), staticReviewed=review_claim(review))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = args.repo.resolve()
    rows, errors = [], []
    for path in sorted(root.glob('assets/car-catalog/*/runtime-prepared/runtime-preparation.json')):
        folder = path.parent.parent
        row = dict(id=folder.name, prepared=False, staticReviewed=False, gameplayAccepted=False, errors=[])
        try:
            cfg, status, overlay, digest = audit_prepared(root, folder)
            row.update(prepared=True, inputDocumentSha256=digest, fittingConfigSha256=status['fittingConfigSha256'])
            reviews = [folder / name for name in ['static-fitting-review.json', 'fitting-review.json'] if (folder / name).exists()]
            row['reviews'] = [audit_review(root, folder, p, cfg, status, overlay, digest) for p in reviews]
            row['staticReviewed'] = bool(reviews) and all(r['staticReviewed'] for r in row['reviews'])
            row['reviewState'] = 'verified-static' if row['staticReviewed'] else 'pending-or-absent'
        except (ValueError, KeyError, OSError, TypeError, subprocess.CalledProcessError) as exc:
            row['staticReviewed'] = False
            row['errors'].append(str(exc))
            errors.append(dict(id=folder.name, error=str(exc)))
        rows.append(row)
    production_diff = subprocess.check_output(['git', 'diff', '40ed6400fd2de4e309b7b8216e2350922ecfa63b', '--', 'data/server-storage'], cwd=root)
    untracked_storage = subprocess.check_output(
        ['git', 'ls-files', '--others', '--exclude-standard', '--', 'data/server-storage'], cwd=root)
    if production_diff or untracked_storage:
        errors.append(dict(id=None, error='Production storage differs from pinned staged base'))
    result = dict(scope='offline evidence audit; no visual inference or gameplay acceptance',
                  canonicalBundles=len(rows), prepared=sum(r['prepared'] for r in rows),
                  staticReviewed=sum(r['staticReviewed'] for r in rows), gameplayAccepted=0,
                  productionStorageUnchanged=not bool(production_diff or untracked_storage), invalidEvidence=len(errors),
                  errors=errors, packages=rows)
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'packages'}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
