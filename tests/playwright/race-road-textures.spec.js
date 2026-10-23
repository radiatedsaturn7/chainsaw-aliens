import { test, expect } from '@playwright/test';

test('road mipmap distance compiles in both renderers and persists in the editor', async ({ page }) => {
  const shaderErrors = [];
  page.on('console', message => {
    if (/shader error|VALIDATE_STATUS|shader.*compile/i.test(message.text())) shaderErrors.push(message.text());
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.__gameReady);
  const result = await page.evaluate(async () => {
    const THREE = await import('/src/vendorBridge/three.js');
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({});
    await editor.openRaceRoadTextures(async () => ({ roadArt: 'test', roadRepeat: 3, roadRepeatWidth: 3,
      roadMipmaps: true, roadMipmapDistance: 4, roadFilter: 'balanced' }));
    const loaded = editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
    editor.getRaceArtSpriteCanvas = () => canvas;
    const threeRenderer = new THREE.WebGLRenderer(); threeRenderer.setSize(64, 64);
    const renderer = { threeRenderer, textureCache: new Map() };
    const texture = editor.getRaceThreeTexture(renderer, 'test', loaded.roadTextures.road);
    const material = editor.getRaceThreeMaterial(renderer, { texture, textureOptions: loaded.roadTextures.road });
    material.vertexColors = false;
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 2;
    threeRenderer.render(scene, camera);
    const programs = threeRenderer.info.programs.length;
    const fallback = editor.getRaceWebGLGroundRenderer(64, 64);
    const fallbackLinked = !!fallback?.gl?.getProgramParameter(fallback.meshProgram, fallback.gl.LINK_STATUS);
    const hasBias = fallback?.meshLocations?.mipmapBias != null;
    geometry.dispose(); material.dispose(); texture.dispose(); threeRenderer.dispose();
    return { distance: loaded.roadTextures.road.mipmapDistance, programs, fallbackLinked, hasBias };
  });
  expect(result).toEqual({ distance: 4, programs: 1, fallbackLinked: true, hasBias: true });
  expect(shaderErrors).toEqual([]);
});

for (const [name, width, height] of [['portrait',390,844],['landscape',844,390],['desktop',1280,800]]) {
  test(`skybox scaling preview and controls fit ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__gameReady);
    const result = await page.evaluate(async ({width,height}) => {
      const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
      const editor = new RaceEditor({});
      editor.handleMenuAction('skybox-next');
      const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
      Object.assign(canvas.style,{position:'fixed',inset:'0',zIndex:'99999'}); document.body.append(canvas);
      const ctx=canvas.getContext('2d'); editor.drawRaceSettingsDialog(ctx,width,height);
      const regions=editor.raceSettingsSliderRegions;
      const scale=regions.find(r=>r.key==='skybox-scale-x');
      editor.updateRaceSettingsSlider(scale,scale.track.x+scale.track.w*(2-.25)/(4-.25));
      const preview=[];const original=editor.drawRaceSkyboxArt.bind(editor);
      editor.drawRaceSkyboxArt=(context,bounds,options)=>{preview.push(editor.getRaceSkyboxSettings());return original(context,bounds,options);};
      editor.drawRaceSettingsDialog(ctx,width,height);
      editor.closeRaceSettingsDialog({accept:true});
      return {label:editor.getMenuItems('settings').find(i=>i.id==='skybox-next').label,
        count:regions.length,inside:regions.every(r=>r.bounds.x>=0&&r.bounds.y>=0&&r.bounds.x+r.bounds.w<=width&&r.bounds.y+r.bounds.h<height-48),
        previewScale:preview.at(-1)?.scaleX,savedScale:editor.getRaceSkyboxSettings().scaleX};
    }, {width,height});
    expect(result).toEqual({label:'Skybox',count:4,inside:true,previewScale:2,savedScale:2});
    await page.screenshot({path:`test-results/race-skybox-${name}.png`});
  });
}
