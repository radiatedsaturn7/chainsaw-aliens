import {pngChunk,riffChunk,webpFile} from '../../src/ui/pixel-editor/animatedImageImport.js';
const word = (n,little=false)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,little);return b;};
export function makeApng(stills,{poster=false}={}) {
  const header=Uint8Array.of(0,0,0,2,0,0,0,1,8,6,0,0,0);
  const parts=[Uint8Array.of(137,80,78,71,13,10,26,10),pngChunk('IHDR',header),pngChunk('acTL',new Uint8Array([...word(stills.length),...word(0)]))];
  const imageChunks=bytes=>{
    const chunks=[];
    for(let p=8;p<bytes.length;){const n=new DataView(bytes.buffer,bytes.byteOffset+p).getUint32(0);const type=String.fromCharCode(...bytes.subarray(p+4,p+8));if(type==='IDAT')chunks.push(bytes.slice(p+8,p+8+n));p+=n+12;}
    return chunks;
  };
  if(poster) for(const data of imageChunks(stills[0]))parts.push(pngChunk('IDAT',data));
  let sequence=0;
  stills.forEach((bytes,i)=>{
    const control=new Uint8Array(26),v=new DataView(control.buffer);
    v.setUint32(0,sequence++);v.setUint32(4,2);v.setUint32(8,1);v.setUint16(20,i?23:7);v.setUint16(22,100);
    control[24]=i?2:1;control[25]=0;
    parts.push(pngChunk('fcTL',control));
    for(const data of imageChunks(bytes)) parts.push(!poster && !i ? pngChunk('IDAT',data):pngChunk('fdAT',new Uint8Array([...word(sequence++),...data])));
  });
  parts.push(pngChunk('IEND',new Uint8Array()));
  return new Blob(parts,{type:'image/png'});
}
export function makeAnimatedWebp(stills) {
  const chunks=[riffChunk('VP8X',Uint8Array.of(0x12,0,0,0,1,0,0,0,0,0)),riffChunk('ANIM',new Uint8Array(6))];
  stills.forEach((bytes,i)=>{
    const data=[];
    for(let p=12;p<bytes.length;){const n=new DataView(bytes.buffer,bytes.byteOffset+p).getUint32(4,true);const type=String.fromCharCode(...bytes.subarray(p,p+4));if(['VP8 ','VP8L','ALPH'].includes(type))data.push(bytes.subarray(p,p+8+n+(n&1)));p+=8+n+(n&1);}
    const header=new Uint8Array(16);header[6]=1;header[12]=i?230:70;header[15]=3;
    chunks.push(riffChunk('ANMF',new Uint8Array([...header,...data.flatMap(b=>[...b])])));
  });
  return new Blob([webpFile(chunks)],{type:'image/webp'});
}
