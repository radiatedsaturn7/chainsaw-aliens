"""Refresh reviewed campaign art in an already validated static preview.
Does not deploy. Run the full static builder first; unrelated new documents
require a full rebuild. Runtime code is not refreshed by this art-only command.
"""
import argparse,json,shutil,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from project_manifest import build_manifest,validate_assets
from static_project_optimizer import publish_document,tree_bytes,decode_document,encode_document

def refresh(site):
 source=Path('data/server-storage/files');target=site/'data/server-storage/files'
 report=json.loads((site/'project-build.json').read_text())
 imports=json.loads(Path('data/campaigns/america/art-imports.json').read_text());manifest=build_manifest(source)
 paths=[manifest['folders']['art'][name] for name in imports]
 paths += [p for name,p in manifest['folders']['doodads'].items() if name in imports]
 paths += [manifest['folders']['races'][name] for name in ['Tower Hill Road','Mount Washington Auto Road — point-to-point','Laurel Highlands Scenic Byway','Ohio River Crossing','Historic Route 66','Angeles Crest Highway','Data Center City','Ozark Backroads','Pikes Peak Highway','Moki Dugway','Oak Creek Canyon']]
 for entries in manifest['folders'].values():
  for relative in entries.values():
   if relative not in paths and not (target/relative).exists():raise ValueError(f'Full build required: {relative}')
 for relative in paths:
  doc=decode_document((source/relative).read_bytes())
  if (target/relative).parent.exists():
   raw=json.dumps(doc)
   if '__chainsawAssetRef' in raw or 'data:image/' in raw:raise ValueError(f'Full build required for embedded media: {relative}')
   (target/relative).write_bytes(encode_document(doc))
   shutil.copyfile((source/relative).with_name('metadata.json'),(target/relative).with_name('metadata.json'))
  else:publish_document(source/relative,target/relative,target)
  assert doc==decode_document((target/relative).read_bytes())
 changed={'folders':{folder:{name:p for name,p in entries.items() if p in paths} for folder,entries in manifest['folders'].items()}}
 validate_assets(target,changed,shared_assets=True)
 (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 shutil.copytree('data/campaigns',site/'data/campaigns',dirs_exist_ok=True)
 # Remove only generated preview copies; repository originals remain intact.
 originals=site/'assets/campaign-art'
 if originals.exists():shutil.rmtree(originals)
 report['folders']={f:len(entries) for f,entries in manifest['folders'].items()}
 original=sum(sum(p.stat().st_size for p in (source/relative).parent.rglob('*') if p.is_file() and 'versions' not in p.relative_to((source/relative).parent).parts) for entries in manifest['folders'].values() for relative in entries.values())
 published=tree_bytes(target)
 report['optimization'].update(sourceProjectBytes=original,publishedProjectBytes=published,savedBytes=original-published,siteBytes=tree_bytes(site))
 report['refreshedCampaignArtDocuments']=len(paths)
 (site/'project-build.json').write_text(json.dumps(report,indent=2)+'\n')
 if tree_bytes(site)>850*1024*1024:raise ValueError('Preview exceeds deployment size budget')
 print(f'Validated {len(paths)} refreshed documents; {tree_bytes(site)} bytes total')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
 refresh(parser.parse_args().output)
