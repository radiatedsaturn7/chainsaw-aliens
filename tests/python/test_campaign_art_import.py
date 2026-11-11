import contextlib,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
import png
SCRIPT=Path(__file__).resolve().parents[2]/'tools/art/import_campaign_art.py'
class CampaignArtImportTests(unittest.TestCase):
 def test_invalid_replacement_preserves_published_art_and_records_pending_source(self):
  spec=importlib.util.spec_from_file_location('campaign_import',SCRIPT);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with tempfile.TemporaryDirectory() as folder:
   previous=Path.cwd()
   try:
    os.chdir(folder);root=Path('data/server-storage/files');root.mkdir(parents=True)
    (root/'manifest.json').write_text(json.dumps({'folders':{'art':{}}}))
    source=Path('assets/campaign-art/test.png');source.parent.mkdir(parents=True)
    with source.open('wb') as f:png.Writer(1,1,greyscale=False,alpha=True).write(f,[[120,30,10,255]])
    module.REVIEWED={'test.png':'test'}
    with contextlib.redirect_stdout(io.StringIO()):module.main()
    target=root/'art/test/document.json';known=target.read_bytes()
    source.write_bytes(b'broken generator upload')
    with contextlib.redirect_stdout(io.StringIO()):module.main()
    self.assertEqual(target.read_bytes(),known)
    pending=json.loads(Path('data/campaigns/america/art-import-pending.json').read_text())
    self.assertIn('test',pending['invalidSources'])
    target.write_text('{"handEdited":true}')
    with self.assertRaisesRegex(RuntimeError,'Preserve local artwork edits'):module.main()
   finally:os.chdir(previous)
if __name__=='__main__':unittest.main()
