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
