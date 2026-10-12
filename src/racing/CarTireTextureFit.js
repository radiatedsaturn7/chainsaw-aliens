// Texture fitting deliberately requires full opacity. Cleanup for separating
// sprites is independent: faint pixels must never become holes in a tire.
const opaque = pixel => typeof pixel === 'string'
  && (pixel.length === 7 || (pixel.length === 9 && pixel.slice(-2).toLowerCase() === 'ff'));

export function tireOpaqueMask(frame, width, height) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = typeof frame[i] === 'string'
    ? Number(opaque(frame[i])) : Number(frame instanceof Uint8ClampedArray && frame[i * 4 + 3] === 255);
  return mask;
}

// Maximal rectangle in a histogram, evaluated for every image row: O(w*h).
export function largestOpaqueRectangle(mask, width, height) {
  const heights = new Uint32Array(width);
  let best = null, bestArea = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) heights[x] = mask[y * width + x] ? heights[x] + 1 : 0;
    const stack = [];
    for (let x = 0; x <= width; x++) {
      const h = x === width ? 0 : heights[x];
      let start = x;
      while (stack.length && stack.at(-1).height > h) {
        const bar = stack.pop(); start = bar.start;
        const area = bar.height * (x - start);
        if (area > bestArea) {
          bestArea = area; best = { x:start, y:y-bar.height+1, width:x-start, height:bar.height };
        }
      }
      if (h && (!stack.length || stack.at(-1).height < h)) stack.push({ start, height:h });
    }
  }
  return best;
}

// Lower envelope of parabolas gives squared Euclidean distances in linear
// time. Querying at +/- half a pixel measures distance to pixel SQUARES,
// not just their centers, so no transparent corner can enter the fitted disk.
function intervalDistance(input) {
  const n = input.length, sites = new Int32Array(n), edges = new Float64Array(n + 1);
  let k = 0; sites[0] = 0; edges[0] = -Infinity; edges[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let p = sites[k];
    let cross = ((input[q] + q*q) - (input[p] + p*p)) / (2*q - 2*p);
    while (k > 0 && cross <= edges[k]) { k--; p = sites[k]; cross = ((input[q]+q*q)-(input[p]+p*p))/(2*q-2*p); }
    k++; sites[k] = q; edges[k] = cross; edges[k+1] = Infinity;
  }
  const result = new Float64Array(n*2-1);
  let at = 0;
  const query = x => { while (at < k && edges[at+1] < x) at++; const p=sites[at]; return (x-p)*(x-p)+input[p]; };
  for (let i=0; i<result.length; i++) {
    const x=i/2;
    result[i] = Math.min(input[Math.floor(x)], input[Math.ceil(x)], query(x-0.5), query(x+0.5));
  }
  return result;
}

// Largest safe circle with centers evaluated at half-pixel increments. The one-pixel surrounding
// border is forbidden too, so the circle cannot leave the source image.
export function largestOpaqueCircle(mask, width, height) {
  const w=width+2, h=height+2, stride=w*2-1, rows=new Float64Array(stride*h);
  for(let y=0;y<h;y++) {
    const input=new Float64Array(w);
    for(let x=1;x<w-1;x++) if(y>0 && y<h-1 && mask[(y-1)*width+x-1]) input[x]=1e15;
    rows.set(intervalDistance(input),y*stride);
  }
  let best=null, bestDistance=-1;
  for(let x=2;x<stride-2;x++) {
    const input=new Float64Array(h);
    for(let y=0;y<h;y++) input[y]=rows[y*stride+x];
    const distances=intervalDistance(input);
    for(let y=2;y<distances.length-2;y++) {
      const distance=distances[y];
      if(distance<=0) continue;
      // Prefer the image center for ties, keeping symmetric wheels centered.
      const centerDistance=(x/2-0.5-width/2)**2+(y/2-0.5-height/2)**2;
      if(distance>bestDistance || (distance===bestDistance && centerDistance<best.centerDistance)) {
        bestDistance=distance; best={x:x/2-0.5,y:y/2-0.5,radius:Math.sqrt(distance),centerDistance};
      }
    }
  }
  if(!best) return null;
  const {centerDistance,...circle}=best;
  return circle;
}

export function fitTireTextureRegions(frames, width, height, { treadFrame=0, wheelFrame=frames.length===8?2:1 }={}) {
  if(!frames[treadFrame] || !frames[wheelFrame]) throw new Error('Select valid tread and wheel frames.');
  const rectangle=largestOpaqueRectangle(tireOpaqueMask(frames[treadFrame],width,height),width,height);
  const circle=largestOpaqueCircle(tireOpaqueMask(frames[wheelFrame],width,height),width,height);
  if(!rectangle || !circle) throw new Error('Tread and wheel need fully opaque pixels. Choose different frames or remove transparency inside the artwork.');
  const radius=Math.max(0.001,circle.radius-0.0001);
  return {
    tread: { region:rectangle, bounds:{x:rectangle.x+0.5,y:rectangle.y+0.5,width:Math.max(0.001,rectangle.width-1),height:Math.max(0.001,rectangle.height-1)} },
    wheel: { region:circle, bounds:{x:circle.x-radius,y:circle.y-radius,width:radius*2,height:radius*2} }
  };
}
