#!/usr/bin/env python3
"""Fail-closed local input probe for exact Jammy run; does not write checkout."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
from importlib.util import module_from_spec,spec_from_file_location
_alias=spec_from_file_location("alias_identity",Path(__file__).with_name("alias-identity.py"))
_alias_module=module_from_spec(_alias);_alias.loader.exec_module(_alias_module)
verify_alias_identity=_alias_module.verify_alias_identity

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda:handle.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()
def hexdigest(x, n=64):
    assert isinstance(x,str) and re.fullmatch(r'[a-f0-9]{%d}'%n,x), x
    return x
def read(path): return json.loads(path.read_bytes())
def git(*args): return subprocess.check_output(['git',*args],text=True).strip()
def file(relative):
    p=Path(relative)
    assert not p.is_absolute() and '..' not in p.parts and p.is_file() and not p.is_symlink(),relative
    assert all(not q.is_symlink() for q in p.parents), relative
    return p
def check(p,h):
    p=file(p)
    assert sha(p)==hexdigest(h),p
    return p

cfg=read(Path(sys.argv[1])); mode=sys.argv[2]; assert mode in ('A','B')
pinned=cfg[mode]
assert git('rev-parse','HEAD')==hexdigest(pinned['commit'],40)
assert git('rev-parse','HEAD^{tree}')==hexdigest(pinned['tree'],40)
assert sha(Path(sys.argv[3]))==hexdigest(cfg['coldSpecSha256'])
mandatory={'package.json','package-lock.json','playwright.config.js','tools/playwright/static-server.cjs',
 '.github/workflows/vehicle-catalog.yml','data/server-storage/files/manifest.json','tests/playwright/car-catalog.spec.js',
 'tests/helpers/tutsanStaticPickerCases.js','tests/helpers/carCatalogPickerTraversalCases.js','tests/helpers/carCatalogBoundedPickerSetup.js'}
if mode=='B': mandatory.add('tests/helpers/carThumbnailBrowseWitness.js')
assert mandatory<=pinned['paths'].keys(),mandatory-pinned['paths'].keys()
for name,digest in pinned['paths'].items(): check(name,digest)
# The sole official gate/dependency/config/runtime catalog spec remain exact A/B.
same=('package.json','package-lock.json','playwright.config.js','.github/workflows/vehicle-catalog.yml','tests/playwright/car-catalog.spec.js')
for name in same: assert cfg['A']['paths'][name]==cfg['B']['paths'][name],name
receipt={'variant':mode,'commit':pinned['commit'],'tree':pinned['tree'],'pinnedPaths':pinned['paths'],'coldSpecSha256':cfg['coldSpecSha256']}
if mode=='B':
    previews=read(check('assets/car-previews/manifest.json',pinned['previewManifestSha256']))
    r=Path('data/server-storage/files')
    canonical=read(file(r/'manifest.json'))
    stock=read(file(r/'stock-preview-release.json'))
    revision=hexdigest(pinned['servedStockRevision'])
    assert stock.get('schemaVersion')==1 and stock['stockPreviewReleaseRevision']==revision==previews['releaseRevision']
    assert stock['projectManifestSha256']==sha(file(r/'manifest.json'))
    assert previews['schemaVersion']==1 and previews['rendererVersion']=='menu-native-v1'
    assert previews['anglesDeg']==[0,45,90,135,180,225,270,315]
    cars={name for name in canonical['folders']['cars']}
    names=previews['carsByName']
    expected_names=cfg['B']['expectedShowroomNames']
    assert len(expected_names)>=max(635,cfg['minimumCarPreviews']) and len(set(expected_names))==len(expected_names)
    assert set(expected_names)<=set(names)<=cars
    specs=previews['previews']
    raw_groups=verify_alias_identity(names,specs,lambda name:file(r/canonical['folders']['cars'][name]).read_bytes())
    expected_name_set=set(expected_names)
    expected_groups={raw:set(group)&expected_name_set for raw,group in raw_groups.items()}
    assert sum(bool(group) for group in expected_groups.values())==len(expected_names)-3

    checked={}; assetfiles=set(); encoded=0
    for name,navid in names.items():
        spec=specs[navid]
        poster=spec['poster']; assert spec['frameCount']==8 and poster['frameIndex']==3 and poster['angleDeg']==135
        for item in (spec,poster):
            url=item['url']
            assert re.fullmatch(r'assets/car-previews/[a-zA-Z0-9._-]+\.(?:webp|png)',url),url
            assert url not in assetfiles
            assetfiles.add(url)
            path=check(url,item['sha256'])
            assert path.stat().st_size==item['bytes']
            encoded+=item['bytes']
        deps=spec['stockSources']
        assert len(deps)>=1 and len(deps)<=32 and {(x['folder'],x['name']) for x in deps if x['folder']=='cars'}=={('cars',name)}
        assert spec['carDocumentSha256']==next(x['sha256'] for x in deps if x['folder']=='cars')
        assert poster['frameWidth']==spec['frameWidth'] and poster['frameHeight']==spec['frameHeight']
        for dep in deps:
            blob=r/canonical['folders'][dep['folder']][dep['name']]
            if blob not in checked:
                path=check(blob,dep['sha256'])
                md=read(file(path.with_name('metadata.json')))
                assert md['stockPreviewReleaseRevision']==revision and md['stockPreviewSha256']==dep['sha256']
                assert md['stockPreviewBytes']==path.stat().st_size
                checked[blob]=dep['sha256']
            assert checked[blob]==dep['sha256']
    receipt.update(previewManifestSha256=pinned['previewManifestSha256'],servedStockRevision=revision,
                   previewCount=len(names),expectedShowroomNamesCount=len(expected_names),stockDeps=len(checked),encodedPreviewBytes=encoded,rawPreviewRuntimeIds=len(raw_groups),
                   sharedRawRuntimeIds={raw:names for raw,names in raw_groups.items() if len(names)>1})
print(json.dumps(receipt,indent=2,sort_keys=True))
