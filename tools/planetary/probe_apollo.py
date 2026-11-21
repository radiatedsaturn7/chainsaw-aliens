"""Inspect the published Apollo GIS archive using byte ranges, not a 1.7 GB download."""
import io,json,zipfile,argparse
from urllib.request import Request,urlopen
from pathlib import Path
URL='https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Apollo17/Apollo17_PDS_fullPackage_Haase.zip'
class RemoteZip(io.RawIOBase):
 def __init__(self,url):
  self.url=url;self.pos=0
  with urlopen(Request(url,method='HEAD'),timeout=40) as r:self.size=int(r.headers['Content-Length']);self.url=r.url
 def seekable(self):return True
 def readable(self):return True
 def tell(self):return self.pos
 def seek(self,n,whence=0):
  self.pos=n if whence==0 else self.pos+n if whence==1 else self.size+n
  return self.pos
 def read(self,n=-1):
  n=self.size-self.pos if n<0 else min(n,self.size-self.pos)
  if n<=0:return b''
  if n>8_000_000:raise ValueError('Refusing oversized archive member')
  data=self.read_at(self.pos,n);self.pos+=n;return data
 def read_at(self,start,n):
  if not 0<n<=8_000_000:raise ValueError('Invalid range size')
  with urlopen(Request(self.url,headers={'Range':f'bytes={start}-{start+n-1}'}),timeout=40) as r:
   if r.status!=206 or not r.headers.get('Content-Range','').startswith(f'bytes {start}-'):raise ValueError('Server did not honor range request')
   data=r.read(n+1)
  if len(data)!=n:raise ValueError('Incomplete range')
  return data
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--extract-traverse',action='store_true');args=parser.parse_args()
 with zipfile.ZipFile(RemoteZip(URL)) as archive:
  entries=[{'name':i.filename,'bytes':i.file_size,'compressedBytes':i.compress_size} for i in archive.infolist()]
  Path('artifacts/planetary/apollo17-archive-index.json').write_text(json.dumps(entries,indent=2)+'\n')
  print(json.dumps([e for e in entries if any(t in e['name'].lower() for t in ('traverse','.prj','readme'))],indent=2))

  if args.extract_traverse:
   out=Path('data/campaigns/planetary/sources');out.mkdir(parents=True,exist_ok=True)
   for e in entries:
    if 'APOLLO17_TRAVERSE_2018.' in e['name'] or e['name'].endswith('AAREADME.TXT'):
     (out/Path(e['name']).name).write_bytes(archive.read(e['name']))
