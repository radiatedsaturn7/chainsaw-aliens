"""Inspect source artwork without changing image pixels. Requires Pillow."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--root',default='assets/campaign-art')
parser.add_argument('--output')
args=parser.parse_args()
results=[]
for path in sorted(Path(args.root).rglob('*.png')):
    with Image.open(path) as im:
        im.load()
        assert im.format == 'PNG', path
        row={'path':path.as_posix(),'width':im.width,'height':im.height,'mode':im.mode,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        if 'A' in im.getbands():
            alpha=im.getchannel('A')
            row['alpha_extrema']=alpha.getextrema()
            row['visible_bounds_alpha_32']=alpha.point(lambda x:255 if x>32 else 0).getbbox()
            assert alpha.getextrema()[0]==0, f'No transparent background: {path}'
        else:
            row['tile_seams']='Not certified seamless; repeated preview and finishing required before production.'
        results.append(row)
output=json.dumps({'png_count':len(results),'assets':results},indent=2)+'\n'
if args.output: Path(args.output).write_text(output)
else: print(output)
