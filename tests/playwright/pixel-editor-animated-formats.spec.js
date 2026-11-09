import {test,expect} from '@playwright/test';
for(const format of ['apng','webp']) test(`imports ${format} as editable frames with alpha and timing`,async({page})=>{
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady && window.__game?.state !== 'loading');
  const result=await page.evaluate(async format=>{
    const {makeApng,makeAnimatedWebp}=await import('/tests/helpers/animatedImageFixtures.js');
    const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
    const ctx=canvas.getContext('2d'),stills=[];
    for(const color of ['#ff0000','#0000ff']){
      ctx.clearRect(0,0,2,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,format==='apng'?'image/png':'image/webp',1));
      stills.push(new Uint8Array(await blob.arrayBuffer()));
    }
    const blob=format==='apng'?makeApng(stills,{poster:true}):makeAnimatedWebp(stills);
    const game=window.__game;game.transitionTo('title');game.enterPixelStudio({returnState:'title'});
    const studio=game.pixelStudio;
    await studio.importImageFromFile(new File([blob],`animation.${format}`,{type:blob.type}));
    const frames=studio.animation.frames.map(f=>({duration:f.durationMs,pixels:[...f.layers[0].pixels]}));
    studio.applyColorToAlpha(0xffffffff);
    const saved=studio.serializeCurrentAnimationAsArtDocument();
    return {frames,savedCount:saved.frames.length};
  },format);
  expect(result.frames.map(f=>f.duration)).toEqual([70,230]);
  expect(result.frames.every(f=>(f.pixels[1]>>>24)===0)).toBeTruthy();
  // WebP may be lossy; assert dominant red then dominant blue, not exact RGB.
  expect(result.frames[0].pixels[0]&255).toBeGreaterThan(200);
  expect((result.frames[1].pixels[0]>>>16)&255).toBeGreaterThan(200);
  expect(result.savedCount).toBe(2);
});
