#!/usr/bin/env python3
"""Focused exact-binding tests using a real complete staged document and fixture roots."""
import base64,gzip,hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('reconcile',Path(__file__).with_name('reconcile-art-roster.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class BindingTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.catalog=self.root/'assets/car-catalog';self.cars=self.root/'data/server-storage/files/cars';self.catalog.mkdir(parents=True);self.cars.mkdir(parents=True)
  self.raw=(root/'data/server-storage/files/cars/Sandspurry Six 1970/document.json').read_bytes();self.doc=mod.decode(self.raw);self.name=self.doc['car']['name'];self.ident=self.doc['car']['id']
 def source(self,ident=None):
  ident=ident or self.ident;p=self.catalog/ident;p.mkdir();hashes={}
  for role in ['body','dashboard','tires']:
   data=b'fixture-'+role.encode();(p/(role+'.png')).write_bytes(data);hashes[role]=hashlib.sha256(data).hexdigest()
  data=dict(id=ident,name=self.name,stableCarId='saved-car:'+self.name,sourceHashes=hashes)
  (p/'package-status.json').write_text(json.dumps(data));(p/'package-config.json').write_text(json.dumps(data))
 def runtime(self,doc=None,compressed=False):
  d=doc or self.doc;raw=json.dumps(d).encode()
  if compressed:raw=json.dumps({'__chainsawStorage':True,'data':base64.b64encode(gzip.compress(raw)).decode()}).encode()
  p=self.cars/self.name;p.mkdir(exist_ok=True);(p/'document.json').write_bytes(raw);return hashlib.sha256(raw).hexdigest()
 def report(self):return mod.main_report(self.root,self.root)
 def test_actual_native_and_compressed_document(self):
  self.source();expected=self.runtime();r=self.report();self.assertEqual(r['counts']['readyBindings'],1);self.assertEqual(r['readyBindings'][0]['document']['inputDocumentSha256'],expected)
  expected=self.runtime(compressed=True);r=self.report();self.assertEqual(r['counts']['readyBindings'],1);self.assertEqual(r['readyBindings'][0]['document']['inputDocumentSha256'],expected)
 def test_temporary_source_key_binds_actual_id_without_guess(self):
  self.source('source-unconfirmed');self.runtime();r=self.report();self.assertEqual(r['readyBindings'][0]['boundRuntimeDocumentId'],self.ident)
 def test_missing_and_conflicting_id(self):
  self.source();self.assertEqual(self.report()['counts']['missingDocuments'],1);self.doc['car']['id']='different-runtime-id';self.runtime();r=self.report();self.assertEqual(r['counts']['idMismatches'],1);self.assertFalse(r['readyBindings'])
 def test_duplicate_source_and_incomplete_document_block(self):
  self.source();self.source('source-duplicate');self.runtime();self.assertEqual(self.report()['counts']['sourceDuplicates'],1);self.assertFalse(self.report()['readyBindings'])
 def test_incomplete_document_and_explicit_null_mechanics(self):
  self.source();self.doc['car']['mechanics']=None;self.runtime();self.assertEqual(self.report()['counts']['readyBindings'],1)
  del self.doc['car']['dimensions'];self.runtime();r=self.report();self.assertFalse(r['readyBindings']);self.assertEqual(r['counts']['blocked'],1)
 def test_existing_art_without_explicit_placeholder_preserved(self):
  self.source();self.doc['car']['catalogProvenance'].pop('placeholder',None);self.runtime();r=self.report();self.assertEqual(r['counts']['existingOriginalsPreserved'],1);self.assertFalse(r['readyBindings'])
if __name__=='__main__':unittest.main()
