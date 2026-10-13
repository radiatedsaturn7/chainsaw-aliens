const lightNeutral = (data, i) => data[i+3] > 0
  && Math.min(data[i],data[i+1],data[i+2]) >= 160
  && Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]) <= 24;

export function hasBakedLightBackground({width,height,data}) {
  // Only suggest removal for opaque images with a consistently light border.
  for(let i=3;i<data.length;i+=4) if(data[i]<250) return false;
  let light=0,total=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(x===0||y===0||x===width-1||y===height-1) {
    total++; if(lightNeutral(data,(y*width+x)*4)) light++;
  }
  return total>0 && light/total>0.95;
}

export function removeCarSheetLightBackground(image) {
  const {width,height}=image, data=new Uint8ClampedArray(image.data);
  const seen=new Uint8Array(width*height), queue=new Int32Array(width*height);
  let head=0,tail=0;
  const add=i=>{ if(seen[i]) return; seen[i]=1; if(lightNeutral(data,i*4)) queue[tail++]=i; };
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  while(head<tail) {
    const i=queue[head++],x=i%width,y=Math.floor(i/width);
    data[i*4+3]=0;
    if(x>0)add(i-1);if(x+1<width)add(i+1);if(y>0)add(i-width);if(y+1<height)add(i+width);
  }
  return {width,height,data,removedPixels:tail};
}
