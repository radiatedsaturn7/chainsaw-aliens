import { test, expect } from '@playwright/test';

test('Race Editor surface preview renders synthetic ridge crossing from playtest surface bake', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });

  const result = await page.evaluate(async () => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
    editor.selectedRace.name = 'Synthetic Ridge Crossing';
    editor.selectedRace.road.nodes = [
      { x: -120, y: 0, elevation: 0, role: 'start', locked: true },
      { x: 0, y: 0, elevation: 0.08 },
      { x: 120, y: 0, elevation: 0 }
    ];
    editor.selectedRace.road.segments = [
      { length: 120, curve: 0, elevation: 0.08, surface: 'asphalt', roadWidthM: 7.2 },
      { length: 120, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 7.2 }
    ];
    editor.selectedRace.renderDebug = {
      ...editor.getRaceRenderDebugSettings(),
      terrainEnabled: true,
      texturesEnabled: false,
      detailEnabled: false,
      editorSurfacePreviewEnabled: true,
      editorSurfaceDebugMode: 'bands'
    };
    const margin = editor.ensureRaceMarginSettings();
    margin.marginMode = 'on';
    margin.widthM = 0.4;
    margin.shoulderMode = 'on';
    margin.shoulderWidthM = 2.5;
    editor.getRaceGroundElevationAtWorldPoint = (point = {}) => {
      const x = Number(point.x || 0);
      const z = Number(point.z ?? point.y ?? 0);
      const ridge = Math.max(0, 1 - Math.abs(x) / 28) * 1.4;
      const ripple = Math.sin(z / 38) * 0.08;
      return ridge + ripple;
    };
    editor.getRaceRawGroundElevationAtWorldPoint = editor.getRaceGroundElevationAtWorldPoint;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    const bounds = { x: 0, y: 0, w: canvas.width, h: canvas.height };

    const runtimeType = editor.getSelectedRaceRuntimeType();
    const routeLength = editor.getRaceRouteLength();
    const preview = editor.getRaceEditorSurfacePreviewBake({
      terrainSize: 24,
      routeLength,
      runtimeType,
      renderDebug: editor.getRaceRenderDebugSettings()
    });
    const playtestBake = editor.buildRaceWorldBake({
      terrainSize: 24,
      routeLength,
      runtimeType,
      renderDebug: editor.getRaceRenderDebugSettings()
    });
    editor.drawRaceTopDownEditor(ctx, bounds);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let bandPixels = 0;
    let magentaPixels = 0;
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const a = image.data[offset + 3];
      if (a > 180 && r > 40 && b > 120 && g > 40) bandPixels += 1;
      if (a > 180 && r > 220 && b > 220 && g < 50) magentaPixels += 1;
    }

    return {
      previewRevision: preview.surfaceRevision,
      playtestRevision: playtestBake.surfaceRevision,
      previewSections: preview.surfaceBake.sections.length,
      validation: preview.validation,
      bandPixels,
      magentaPixels
    };
  });

  expect(result.previewRevision).toBe(result.playtestRevision);
  expect(result.previewSections).toBeGreaterThan(4);
  expect(result.bandPixels).toBeGreaterThan(1000);
  expect(result.validation.degenerateTriangles).toBe(0);
  expect(result.validation.magentaEdges || 0).toBe(0);
  expect(result.validation.nonManifoldEdges || 0).toBe(0);
});
