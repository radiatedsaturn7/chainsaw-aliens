import { test, expect } from '@playwright/test';
for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
  test(`CVT tuning renders and edits all fields at ${viewport.width}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/fixtures/electric-editor.html');
    const result = await page.evaluate(async ({width,height}) => {
      const {default: RaceEditor} = await import('/src/ui/RaceEditor.js');
      const editor = new RaceEditor({});
      const cvt={minRatio:.357,maxRatio:2.805,cruiseRpm:1800,powerRpm:6000,ratioRatePerSecond:1};
      editor.selectedCar.tuning.cvt={...cvt};
      editor.selectedCar.transmissions={automatic:{cvt:{...cvt},gearRatios:[2.805],gearFinalDrive:5.034,reverseRatio:1.797}};
      editor.selectedCar.defaultTransmissionType='automatic';
      editor.carTuneTab='gear-ratios';
      const canvas=document.querySelector('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d'), bounds={x:8,y:30,w:width-16,h:Math.min(height-60,300)};
      const seen=new Set(), failures=[];
      function draw() {ctx.fillStyle='#10141b';ctx.fillRect(0,0,width,height);editor.drawCarTunePanel(ctx,bounds);}
      draw();const scroll=editor.carTuneScrollRegion;
      for(let i=0;i<=(scroll?.maxScroll||0);i++) {
        if(scroll)editor.menuScrollState[scroll.scrollKey]=i;draw();
        for(const region of editor.carDriveSliderRegions){
          seen.add(region.key);
          if(region.track.x<0||region.track.x+region.track.w>width||region.track.y>height)failures.push(region.key);
          if(!editor.getCarDriveSliderHit({x:region.track.x+region.track.w/2,y:region.track.y}))failures.push('hit '+region.key);
        }
      }
      const region=editor.carDriveSliderRegions.find(r=>r.key==='cvt-ratioRatePerSecond');
      const edited=editor.updateCarDriveSlider(region,region.track.x+region.track.w*.25);
      const restored=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.selectedCar)));
      draw();
      const pixels=ctx.getImageData(0,0,width,height).data;
      let foreground=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>80||pixels[i+1]>80||pixels[i+2]>80)foreground++;
      return {count:seen.size,failures,edited,lift:restored.tuning.cvt.ratioRatePerSecond,foreground};
    },viewport);
    expect(result.failures).toEqual([]);expect(result.count).toBe(5);
    expect(result.edited).toBe(true);expect(Math.abs(result.lift - (.05 + (10 - .05) * .25))).toBeLessThanOrEqual(.00051);expect(result.foreground).toBeGreaterThan(100);
    await page.screenshot({path:testInfo.outputPath('cvt-editor.png')});
  });
}
