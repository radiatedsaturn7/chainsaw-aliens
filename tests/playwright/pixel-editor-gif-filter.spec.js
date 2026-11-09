import { test, expect } from '@playwright/test';

for (const viewport of [{width:390,height:844},{width:844,height:390},{width:1280,height:800}]) {
  test(`animated GIF and color to alpha workflow ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/index.html');
    await page.waitForFunction(()=>window.__gameReady && window.__game?.state !== 'loading');
    await page.evaluate(async () => {
      const {createFrame,exportAnimatedGif} = await import('/src/ui/pixel-editor/animation.js');
      const {createLayer} = await import('/src/ui/pixel-editor/layers.js');
      const game=window.__game;
      game.transitionTo('title');game.enterPixelStudio({returnState:'title'});
      const layer=createLayer(2,1,'Image');layer.pixels.set([0xffffffff,0xff0000ff]);
      const gif=exportAnimatedGif([createFrame([layer],70),createFrame([layer],230)],2,1);
      await game.pixelStudio.importImageFromFile(new File([gif],'animated.gif',{type:'image/gif'}));
      window.__filter = game.pixelStudio.chooseCanvasFilter();
    });
    await page.getByRole('button',{name:'Color to Alpha',exact:true}).click();
    await page.getByRole('button',{name:'White',exact:true}).click();
    await page.getByRole('button',{name:'All frames',exact:true}).click();
    const result=await page.evaluate(async()=>{
      await window.__filter;
      const studio=window.__game.pixelStudio;
      const after=studio.animation.frames.map(f=>[...f.layers[0].pixels]);
      const durations=studio.animation.frames.map(f=>f.durationMs);
      studio.runtime.undo();
      const undo=studio.animation.frames.map(f=>f.layers[0].pixels[0]);
      studio.runtime.redo();
      const saved=studio.serializeCurrentAnimationAsArtDocument();
      return {after,durations,undo,savedFrames:saved.frames};
    });
    expect(result.after).toEqual([[0,0xff0000ff],[0,0xff0000ff]]);
    expect(result.durations).toEqual([70,230]);
    expect(result.undo).toEqual([0xffffffff,0xffffffff]);
    expect(result.savedFrames).toEqual([[null,'#ff0000'],[null,'#ff0000']]);
  });
}
