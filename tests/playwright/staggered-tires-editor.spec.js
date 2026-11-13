import { test, expect } from '@playwright/test';
for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
  test(`Axle tire sizes render and serialize at ${viewport.width}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/fixtures/electric-editor.html');
    const result = await page.evaluate(async ({width,height}) => {
      const {default: RaceEditor} = await import('/src/ui/RaceEditor.js');
      const editor = new RaceEditor({});
      editor.selectedCar.setup.tireSize={widthMm:235,aspectRatio:45,wheelDiameterIn:17};
      editor.carTuneTab='size';
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
      const region=editor.carDriveSliderRegions.find(r=>r.key==='tireSize-rear-wheelDiameterIn');
      const edited=editor.updateCarDriveSlider(region,region.track.x+region.track.w*.25);
      const restored=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.selectedCar)));
      draw();
      const pixels=ctx.getImageData(0,0,width,height).data;
      let foreground=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>80||pixels[i+1]>80||pixels[i+2]>80)foreground++;
      return {count:seen.size,failures,edited,rear:restored.setup.tireSizeByAxle.rear.wheelDiameterIn,front:restored.setup.tireSize.widthMm,foreground};
    },viewport);
    expect(result.failures).toEqual([]);expect(result.count).toBe(6);
    expect(result.edited).toBe(true);expect(result.rear).toBe(14);expect(result.front).toBe(235);expect(result.foreground).toBeGreaterThan(100);
    await page.screenshot({path:testInfo.outputPath('staggered-editor.png')});
  });
}

test('physical wheel renderer uses matching local and worker-profile axle dimensions',async({page},testInfo)=>{
 await page.goto('/tests/fixtures/electric-editor.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning}=await import('/src/racing/simulation/VehicleDynamicsRunner.js');
  const {createVehicleRenderStateFromRunner,createVehicleRenderProfileFromRunner}=await import('/src/racing/simulation/VehicleRenderState.js');
  const editor=new RaceEditor({}),car=editor.selectedCar;
  car.setup.tireSize={widthMm:235,aspectRatio:45,wheelDiameterIn:17};
  car.setup.tireSizeByAxle={rear:{widthMm:255,aspectRatio:40,wheelDiameterIn:17}};
  const runner=new VehicleDynamicsRunner({config:createVehicleDynamicsConfigFromTuning(editor.getRaceCarTuning())});
  const renderState=createVehicleRenderStateFromRunner(runner),profile=createVehicleRenderProfileFromRunner(runner);
  const scene=new THREE.Scene(),ctx={scene};
  const draw=()=>{
   editor.addRaceThreePhysicsVehicleRig(ctx,{renderState,profile});
   return ['fl','fr','rl','rr'].map(id=>{
    const wheel=scene.getObjectByName(`physicsWheelCylinder:${id}`);
    return {radius:wheel.geometry.parameters.radiusTop,width:wheel.geometry.parameters.height};
   });
  };
  const direct=draw();
  // Worker packed poses deliberately omit static geometry; profile supplies it.
  for(const wheel of Object.values(renderState.wheels)){delete wheel.radiusM;delete wheel.widthM;}
  const worker=draw();
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});
  renderer.setSize(700,450);renderer.setClearColor('#10141b');
  const camera=new THREE.PerspectiveCamera(40,700/450,.1,100);camera.position.set(5,4,6);camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  return {direct,worker};
 });
 expect(result.worker).toEqual(result.direct);
 expect(result.direct[0].radius).toBeCloseTo(.32165,6);
 expect(result.direct[2].radius).toBeCloseTo(.3179,6);
 expect(result.direct[2].width).toBeCloseTo(.255,6);
 await page.screenshot({path:testInfo.outputPath('staggered-physical-wheel-rig.png')});
});
