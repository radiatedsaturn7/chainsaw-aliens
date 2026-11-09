// Demux animation into still images, using the browser's PNG/WebP codecs.
// This also works on browsers without the WebCodecs ImageDecoder API.
// References: w3.org/TR/png-3/ and developers.google.com/speed/webp/docs/riff_container
const ascii = bytes => String.fromCharCode(...bytes);
const text = value => Uint8Array.from(value, c => c.charCodeAt(0));
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const u32 = (bytes, offset = 0, little = false) => view(bytes).getUint32(offset, little);
const u24 = (b, p) => b[p] | b[p + 1] << 8 | b[p + 2] << 16;
const join = parts => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
const word = (n, little = false) => { const bytes = new Uint8Array(4); view(bytes).setUint32(0, n, little); return bytes; };
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
export const pngChunk = (type, data) => {
  const payload = join([text(type), data]);
  return join([word(data.length), payload, word(crc32(payload))]);
};
export const riffChunk = (type, data) => join([text(type), word(data.length, true), data, new Uint8Array(data.length & 1)]);
export const webpFile = chunks => { const data = join([text('WEBP'), ...chunks]); return join([text('RIFF'), word(data.length, true), data]); };
const pngSignature = Uint8Array.of(137,80,78,71,13,10,26,10);

function parsePng(bytes) {
  let header, animation, current, ended = false;
  const shared = [], frames = [];
  let sequence = 0;
  for (let pos = 8; pos < bytes.length;) {
    if (pos + 12 > bytes.length) throw Error('Truncated PNG chunk');
    const size = u32(bytes, pos), end = pos + size + 12;
    if (end > bytes.length) throw Error('Truncated PNG data');
    const type = ascii(bytes.subarray(pos + 4, pos + 8)), data = bytes.subarray(pos + 8, end - 4);
    if (type === 'IHDR') { if (size !== 13) throw Error('Invalid PNG header'); header = data; }
    else if (type === 'acTL') {
      if (size !== 8) throw Error('Invalid APNG animation control');
      animation = { count: u32(data), loop: u32(data, 4) !== 1 };
    } else if (type === 'fcTL') {
      if (!animation || size !== 26 || u32(data) !== sequence++) throw Error('Invalid APNG frame control');
      current = { width: u32(data,4), height: u32(data,8), x: u32(data,12), y: u32(data,16),
        durationMs: Math.max(1, 1000 * view(data).getUint16(20) / (view(data).getUint16(22) || 100)),
        disposal: data[24], blend: data[25] === 1, chunks: [] };
      if (data[24] > 2 || data[25] > 1) throw Error('Invalid APNG disposal or blend');
      frames.push(current);
    } else if (type === 'IDAT') {
      // A default poster outside the animation has no preceding fcTL.
      if (current) current.chunks.push(pngChunk('IDAT', data));
    } else if (type === 'fdAT') {
      if (!current || size < 4 || u32(data) !== sequence++) throw Error('Invalid APNG frame data');
      current.chunks.push(pngChunk('IDAT', data.subarray(4)));
    } else if (type === 'IEND') { ended = true; break; }
    else if (['PLTE','tRNS','cHRM','gAMA','iCCP','sRGB','sBIT'].includes(type)) shared.push(bytes.subarray(pos,end));
    pos = end;
  }
  if (!animation) return null;
  if (!header || !ended || !frames.length || frames.length !== animation.count) throw Error('Incomplete APNG animation');
  for (const frame of frames) {
    if (!frame.chunks.length) throw Error('Empty APNG frame');
    const ihdr = header.slice(); view(ihdr).setUint32(0,frame.width); view(ihdr).setUint32(4,frame.height);
    frame.blob = new Blob([pngSignature,pngChunk('IHDR',ihdr),...shared,...frame.chunks,pngChunk('IEND',new Uint8Array())],{type:'image/png'});
    delete frame.chunks;
  }
  return { width: u32(header), height: u32(header,4), loop: animation.loop, background: [0,0,0,0], frames };
}

function parseWebp(bytes) {
  const end = u32(bytes,4,true) + 8;
  if (end > bytes.length) throw Error('Truncated WebP');
  let width, height, animated = false, loop = true, background = [0,0,0,0], icc;
  const frames = [];
  for (let pos = 12; pos < end;) {
    if (pos + 8 > end) throw Error('Truncated WebP chunk');
    const type = ascii(bytes.subarray(pos,pos+4)), size = u32(bytes,pos+4,true), next = pos + 8 + size + (size & 1);
    if (next > end) throw Error('Truncated WebP data');
    const data = bytes.subarray(pos+8,pos+8+size);
    if (type === 'VP8X') {
      if (size !== 10) throw Error('Invalid WebP header');
      animated = !!(data[0] & 2); width = u24(data,4)+1; height = u24(data,7)+1;
    } else if (type === 'ICCP') icc = riffChunk(type,data);
    else if (type === 'ANIM') {
      if (size !== 6) throw Error('Invalid WebP animation control');
      background = [data[2],data[1],data[0],data[3]];
      loop = view(data).getUint16(4,true) !== 1;
    } else if (type === 'ANMF') {
      if (size < 16) throw Error('Invalid WebP frame');
      const w = u24(data,6)+1, h = u24(data,9)+1;
      let alpha = false, hasImage = false;
      for (let p = 16; p < data.length;) {
        if (p + 8 > data.length) throw Error('Truncated WebP frame chunk');
        const kind = ascii(data.subarray(p,p+4)), length = u32(data,p+4,true);
        if (p + 8 + length + (length & 1) > data.length) throw Error('Truncated WebP frame image');
        if (kind === 'ALPH') alpha = true;
        if (kind === 'VP8 ' || kind === 'VP8L') hasImage = true;
        if (kind === 'VP8L' && length >= 5 && (data[p+12] & 16)) alpha = true;
        p += 8 + length + (length & 1);
      }
      if (!hasImage) throw Error('Missing WebP frame image');
      // A still extended WebP header enables ALPH+VP8 and VP8L transparency.
      const extended = Uint8Array.of((alpha ? 0x10 : 0) | (icc ? 0x20 : 0),0,0,0,(w-1)&255,((w-1)>>8)&255,((w-1)>>16)&255,(h-1)&255,((h-1)>>8)&255,((h-1)>>16)&255);
      frames.push({width:w,height:h,x:u24(data,0)*2,y:u24(data,3)*2,durationMs:Math.max(1,u24(data,12)),
        disposal: data[15] & 1, blend: !(data[15] & 2),
        blob: new Blob([webpFile([riffChunk('VP8X',extended),...(icc?[icc]:[]),data.subarray(16)])],{type:'image/webp'})});
    }
    pos = next;
  }
  if (!animated) return null;
  if (!frames.length) throw Error('WebP contains no animation frames');
  return {width,height,loop,background,frames};
}

export function parseAnimatedImage(input) {
  const bytes = new Uint8Array(input);
  let result = null;
  if (bytes.length >= 8 && pngSignature.every((b,i)=>bytes[i]===b)) result = parsePng(bytes);
  else if (bytes.length >= 12 && ascii(bytes.subarray(0,4))==='RIFF' && ascii(bytes.subarray(8,12))==='WEBP') result = parseWebp(bytes);
  if (!result) return null;
  const {width,height,frames} = result;
  if (!width || !height || width*height > 16*1024*1024) throw Error('Animation canvas is too large');
  if (frames.length > 1000 || frames.length*width*height > 256*1024*1024) throw Error('Animation has too many pixels or frames');
  for (const f of frames) if (!f.width || !f.height || f.x+f.width>width || f.y+f.height>height) throw Error('Invalid animation frame bounds');
  return result;
}

async function loadStill(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve,reject)=>{
      const image = new Image();
      image.onload = ()=>resolve(image);
      image.onerror = ()=>reject(Error('Unable to decode animation frame'));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export async function decodeAnimatedImage(input, {maxDimension=512, loadImage=loadStill, createCanvas=()=>document.createElement('canvas')}={}) {
  const animation = parseAnimatedImage(input);
  if (!animation) return null;
  const scale = Math.min(1,maxDimension/Math.max(animation.width,animation.height));
  const width = Math.max(1,Math.round(animation.width*scale)), height = Math.max(1,Math.round(animation.height*scale));
  if (width*height*animation.frames.length > 32*1024*1024) throw Error('Animation has too many pixels to import');
  const canvas = createCanvas(); canvas.width=animation.width; canvas.height=animation.height;
  const ctx = canvas.getContext('2d');
  const output = createCanvas(); output.width=width; output.height=height;
  const out = output.getContext('2d'); out.imageSmoothingEnabled=false;
  const [r,g,b,a] = animation.background;
  const clear = (x,y,w,h)=>{ ctx.clearRect(x,y,w,h); if (a) {ctx.fillStyle=`rgba(${r},${g},${b},${a/255})`;ctx.fillRect(x,y,w,h);} };
  clear(0,0,canvas.width,canvas.height);
  const frames = [];
  for (const f of animation.frames) {
    const image = await loadImage(f.blob);
    const previous = f.disposal===2 ? ctx.getImageData(f.x,f.y,f.width,f.height) : null;
    if (!f.blend) ctx.clearRect(f.x,f.y,f.width,f.height);
    ctx.drawImage(image,f.x,f.y,f.width,f.height);
    out.clearRect(0,0,width,height); out.drawImage(canvas,0,0,width,height);
    const data = out.getImageData(0,0,width,height).data;
    const pixels = new Uint32Array(width*height);
    for (let i=0;i<pixels.length;i++) pixels[i]=(data[i*4+3]<<24)|(data[i*4+2]<<16)|(data[i*4+1]<<8)|data[i*4];
    frames.push({pixels,durationMs:f.durationMs});
    if (f.disposal===1) clear(f.x,f.y,f.width,f.height);
    if (previous) ctx.putImageData(previous,f.x,f.y);
  }
  return {width,height,scale,loop:animation.loop,frames};
}
