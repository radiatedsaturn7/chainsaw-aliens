import { test, expect } from '@playwright/test';

test('portrait dirt stays on the 3D ground and is hidden by objects in front', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html');
  const result = await page.evaluate(async () => {
    const THREE = await import('/src/vendorBridge/three.js');
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({ isMobile: true, deviceIsMobile: true });
    const renderer = { scene: new THREE.Scene() };
    const camera = new THREE.PerspectiveCamera(62, 390 / 844, 0.1, 100);
    camera.position.set(0, 4, 5);
    camera.lookAt(0, 0, 0);
    const webgl = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    webgl.setSize(390, 844);
    webgl.setClearColor(0xffffff, 1);
    editor.getRaceTrackStateVisualCells = () => [{ x: 0, z: 0, dirt: 1 }];
    editor.getRaceBakedSurfaceAtWorldPoint = () => ({ elevation: 0 });
    const stats = {};
    editor.syncRaceThreeTrackState(renderer, { stats });
    const pixel = () => {
      webgl.render(renderer.scene, camera);
      const rgba = new Uint8Array(4);
      const gl = webgl.getContext();
      gl.readPixels(195, 422, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      return [...rgba];
    };
    const dirt = pixel();
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    blocker.position.set(0, 0.6, 0);
    renderer.scene.add(blocker);
    const occluded = pixel();
    // Use the actual render flag for the legacy-overlay guard.
    editor.lastRaceRenderStats = stats;
    editor.playtestSession = { trackState: {} };
    editor.getRaceTrackStateVisualCells = () => { throw new Error('legacy overlay drew over 3D scene'); };
    const suppressed = editor.drawRaceTrackStateOverlay({}, { x: 0, y: 0, w: 390, h: 844 }, { camera: {} });
    webgl.dispose();
    return { dirt, occluded, suppressed, rendererActive: stats.threeTrackStateRenderer };
  });
  expect(result.dirt[0]).toBeGreaterThan(result.dirt[2]);
  expect(result.dirt[0]).toBeLessThan(255);
  expect(result.occluded.slice(0, 3)).toEqual([0, 0, 255]);
  expect(result.suppressed).toBe(0);
  expect(result.rendererActive).toBe(1);
});
