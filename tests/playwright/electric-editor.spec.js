import { test, expect } from '@playwright/test';
for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
  test(`electric tuning renders and edits all fields at ${viewport.width}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/fixtures/electric-editor.html');
    const result = await page.evaluate(async ({width,height}) => {
      const {default: RaceEditor} = await import('/src/ui/RaceEditor.js');
      const {normalizeElectricTuning} = await import('/src/racing/simulation/ElectricPowertrainModel.js');
      const editor = new RaceEditor({});
      editor.selectedCar.tuning = normalizeElectricTuning({powertrainType:'electric',electricPowertrain:{
        peakTorqueNm:700,peakPowerKw:400,maxMotorRpm:18000,reductionRatio:10.65,
        usableBatteryKwh:70,driveEfficiency:.9,regenEfficiency:.8,maxRegenTorqueNm:100,
        maxRegenPowerKw:50,standstillLossKw:2,regenFullSpeedRadps:5,liftOffRegen:.5}});
      editor.carTuneTab='power-curve';
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
      const region=editor.carDriveSliderRegions.find(r=>r.key==='electric-liftOffRegen');
      const edited=editor.updateCarDriveSlider(region,region.track.x+region.track.w*.25);
      const restored=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.selectedCar)));
      draw();
      const pixels=ctx.getImageData(0,0,width,height).data;
      let foreground=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>80||pixels[i+1]>80||pixels[i+2]>80)foreground++;
      return {count:seen.size,failures,edited,lift:restored.tuning.electricPowertrain.liftOffRegen,foreground};
    },viewport);
    expect(result.failures).toEqual([]);expect(result.count).toBe(12);
    expect(result.edited).toBe(true);expect(result.lift).toBeCloseTo(.25,4);expect(result.foreground).toBeGreaterThan(100);
    await page.screenshot({path:testInfo.outputPath('electric-editor.png')});
  });
}
