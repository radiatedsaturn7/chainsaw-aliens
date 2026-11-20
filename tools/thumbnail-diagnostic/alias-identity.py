"""Verify distinct display identities without rewriting historical raw runtime IDs."""
import base64
import gzip
import hashlib
import json

STARTER_NAMES = frozenset(('BUSE-019', 'CT-86', 'PZ-24', 'RTG-001'))

def document_id(payload):
    doc=json.loads(payload)
    if doc.get('__chainsawStorage'):
        assert doc['encoding']=='json-gzip-base64'
        doc=json.loads(gzip.decompress(base64.b64decode(doc['data'],validate=True)))
    return doc['car']['id']

def verify_alias_identity(names,specs,read_document,*,require_starters=True):
    assert len(set(names.values()))==len(names),'display-name preview keys must be distinct'
    assert set(names.values())==set(specs),'extra/missing preview key'
    ids={}
    for name,key in names.items():
        spec=specs[key]
        payload=read_document(name)
        expected=hashlib.sha256(payload).hexdigest()
        assert spec['carDocumentSha256']==expected,(name,'wrong saved document')
        sources=[r for r in spec['stockSources'] if r['folder']=='cars']
        assert [(r['name'],r['sha256']) for r in sources]==[(name,expected)],(name,'wrong exclusive cars owner')
        raw=document_id(payload)
        assert spec.get('carId',key)==raw,(name,'wrong raw runtime identity')
        ids.setdefault(raw,set()).add(name)
    if require_starters:
        assert ids.get('starter-rwd')==STARTER_NAMES,ids.get('starter-rwd')
    for raw,group in ids.items():
        if len(group)>1:
            assert raw=='starter-rwd' and group==STARTER_NAMES,(raw,group)
            entries=[specs[names[n]] for n in group]
            assert all(x.get('carId')==raw for x in entries),'no inferred raw ID for aliases'
            assert len({x['sha256'] for x in entries})==len(entries),'aliased atlas pixels'
            assert len({x['poster']['sha256'] for x in entries})==len(entries),'aliased poster pixels'
    return {k:sorted(v) for k,v in ids.items()}
