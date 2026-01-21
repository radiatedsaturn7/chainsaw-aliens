const DEFAULT_PALETTE = [
  { id: 'clear', label: 'Clear', color: null },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'black', label: 'Black', color: '#101010' },
  { id: 'gray', label: 'Gray', color: '#7b7b7b' },
  { id: 'blue', label: 'Blue', color: '#4fb7ff' },
  { id: 'red', label: 'Red', color: '#ff6a6a' },
  { id: 'orange', label: 'Orange', color: '#ff9c42' },
  { id: 'yellow', label: 'Yellow', color: '#ffd24a' },
  { id: 'green', label: 'Green', color: '#55d68a' },
  { id: 'purple', label: 'Purple', color: '#b48dff' },
  { id: 'teal', label: 'Teal', color: '#43d5d0' },
  { id: 'pink', label: 'Pink', color: '#ff8ad4' }
];

const TOOL_LIST = [
  { id: 'paint', label: 'Paint' },
  { id: 'erase', label: 'Erase' },
  { id: 'copy', label: 'Copy' },
  { id: 'paste', label: 'Paste' },
  { id: 'clone', label: 'Clone' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'oval', label: 'Oval' },
  { id: 'rounded-oval', label: 'Rounded Oval' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'dropper', label: 'Color Dropper' },
  { id: 'fill', label: 'Fill' },
  { id: 'preview', label: 'Preview' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'zoom-out', label: 'Zoom Out' },
  { id: 'cut-image', label: 'Cut From Image' }
];

const OBJECT_TYPES = ['Tiles', 'Enemies', 'Players', 'Animations'];
const ZOOM_LEVELS = [8, 12, 16, 20, 24, 28, 32];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hexToRgb = (hex) => {
  if (!hex) return null;
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const colorDistance = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
};

export default class PixelStudio {
  constructor(game) {
    this.game = game;
    this.tools = TOOL_LIST;
    this.toolIndex = 0;
    this.palette = DEFAULT_PALETTE;
    this.paletteIndex = 1;
    this.objectTypes = OBJECT_TYPES;
    this.objectIndex = 0;
    this.focus = 'tools';
    this.gridSize = 16;
    this.zoomIndex = 2;
    this.previewEnabled = true;
    this.pixels = Array(this.gridSize * this.gridSize).fill(null);
    this.clipboard = null;
    this.painting = false;
    this.canvasBounds = null;
    this.paletteBounds = [];
    this.toolBounds = [];
    this.objectBounds = [];
    this.cutBounds = null;
    this.cutImageRect = null;
    this.cutSelection = null;
    this.cutDragging = false;
    this.cutSelectionStart = null;
    this.cutImage = null;
    this.cutCanvas = document.createElement('canvas');
    this.cutCanvasCtx = this.cutCanvas.getContext('2d');
    this.imageInput = document.createElement('input');
    this.imageInput.type = 'file';
    this.imageInput.accept = 'image/*';
    this.imageInput.style.display = 'none';
    document.body.appendChild(this.imageInput);
    this.imageInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        this.cutImage = img;
        this.cutSelection = null;
      };
      img.src = URL.createObjectURL(file);
    });
  }

  resetFocus() {
    this.focus = 'tools';
  }

  update(input) {
    const left = input.wasPressed('left') || input.wasGamepadPressed('dpadLeft');
    const right = input.wasPressed('right') || input.wasGamepadPressed('dpadRight');
    const up = input.wasPressed('up') || input.wasGamepadPressed('dpadUp');
    const down = input.wasPressed('down') || input.wasGamepadPressed('dpadDown');
    const interact = input.wasPressed('interact');

    if (this.focus === 'tools') {
      if (up) this.toolIndex = (this.toolIndex - 1 + this.tools.length) % this.tools.length;
      if (down) this.toolIndex = (this.toolIndex + 1) % this.tools.length;
      if (left) this.focus = 'object';
      if (right) this.focus = 'canvas';
      if (down && this.toolIndex === this.tools.length - 1) {
        this.focus = 'palette';
      }
    } else if (this.focus === 'object') {
      if (up) this.objectIndex = (this.objectIndex - 1 + this.objectTypes.length) % this.objectTypes.length;
      if (down) this.objectIndex = (this.objectIndex + 1) % this.objectTypes.length;
      if (right) this.focus = 'tools';
    } else if (this.focus === 'palette') {
      if (left) this.paletteIndex = (this.paletteIndex - 1 + this.palette.length) % this.palette.length;
      if (right) this.paletteIndex = (this.paletteIndex + 1) % this.palette.length;
      if (up) this.focus = 'tools';
    } else if (this.focus === 'canvas') {
      if (left) this.focus = 'tools';
      if (down) this.focus = 'palette';
      if (up && this.cutImage) this.focus = 'cut';
    } else if (this.focus === 'cut') {
      if (down) this.focus = 'canvas';
      if (left) this.focus = 'tools';
    }

    if (interact) {
      const tool = this.tools[this.toolIndex];
      if (!tool) return;
      if (tool.id === 'preview') {
        this.previewEnabled = !this.previewEnabled;
      }
      if (tool.id === 'zoom-in') {
        this.zoomIndex = clamp(this.zoomIndex + 1, 0, ZOOM_LEVELS.length - 1);
      }
      if (tool.id === 'zoom-out') {
        this.zoomIndex = clamp(this.zoomIndex - 1, 0, ZOOM_LEVELS.length - 1);
      }
      if (tool.id === 'copy') {
        this.clipboard = [...this.pixels];
      }
      if (tool.id === 'paste' && this.clipboard) {
        this.pixels = [...this.clipboard];
      }
      if (tool.id === 'clone') {
        this.clipboard = [...this.pixels];
        this.pixels = [...this.clipboard];
      }
      if (tool.id === 'fill') {
        const color = this.palette[this.paletteIndex]?.color ?? null;
        this.pixels = this.pixels.map(() => color);
      }
      if (tool.id === 'cut-image') {
        if (!this.cutImage) {
          this.imageInput.click();
        } else if (this.cutSelection) {
          this.applyCutSelection();
        }
      }
    }
  }

  handlePointerDown(payload) {
    const { x, y } = payload;
    if (this.canvasBounds && this.isPointInBounds(x, y, this.canvasBounds)) {
      this.painting = true;
      this.paintAt(x, y);
      this.focus = 'canvas';
      return;
    }
    const paletteHit = this.paletteBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (paletteHit) {
      this.paletteIndex = paletteHit.index;
      this.focus = 'palette';
      return;
    }
    const toolHit = this.toolBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (toolHit) {
      this.toolIndex = toolHit.index;
      this.focus = 'tools';
      return;
    }
    const objectHit = this.objectBounds.find((bounds) => this.isPointInBounds(x, y, bounds));
    if (objectHit) {
      this.objectIndex = objectHit.index;
      this.focus = 'object';
      return;
    }
    if (this.cutImageRect && this.isPointInBounds(x, y, this.cutImageRect)) {
      this.cutDragging = true;
      this.cutSelectionStart = { x, y };
      this.cutSelection = { x, y, w: 1, h: 1 };
      this.focus = 'cut';
    }
  }

  handlePointerMove(payload) {
    if (this.painting) {
      this.paintAt(payload.x, payload.y);
    }
    if (this.cutDragging && this.cutImageRect) {
      const start = this.cutSelectionStart;
      const endX = clamp(payload.x, this.cutImageRect.x, this.cutImageRect.x + this.cutImageRect.w);
      const endY = clamp(payload.y, this.cutImageRect.y, this.cutImageRect.y + this.cutImageRect.h);
      const x = Math.min(start.x, endX);
      const y = Math.min(start.y, endY);
      const w = Math.abs(endX - start.x);
      const h = Math.abs(endY - start.y);
      this.cutSelection = { x, y, w, h };
    }
  }

  handlePointerUp() {
    this.painting = false;
    this.cutDragging = false;
    this.cutSelectionStart = null;
  }

  paintAt(x, y) {
    if (!this.canvasBounds) return;
    const { x: startX, y: startY, cellSize } = this.canvasBounds;
    const col = Math.floor((x - startX) / cellSize);
    const row = Math.floor((y - startY) / cellSize);
    if (col < 0 || row < 0 || col >= this.gridSize || row >= this.gridSize) return;
    const tool = this.tools[this.toolIndex];
    if (!tool) return;
    if (!['paint', 'erase', 'dropper'].includes(tool.id)) return;
    const index = row * this.gridSize + col;
    if (tool.id === 'dropper') {
      const current = this.pixels[index];
      const paletteIndex = this.palette.findIndex((entry) => entry.color === current);
      if (paletteIndex >= 0) {
        this.paletteIndex = paletteIndex;
      }
      return;
    }
    const color = tool.id === 'erase' ? null : this.palette[this.paletteIndex]?.color ?? null;
    this.pixels[index] = color;
  }

  applyCutSelection() {
    if (!this.cutImage || !this.cutSelection || !this.cutImageRect) return;
    const { x, y, w, h } = this.cutSelection;
    const scaleX = this.cutImage.width / this.cutImageRect.w;
    const scaleY = this.cutImage.height / this.cutImageRect.h;
    const sx = Math.floor(clamp((x - this.cutImageRect.x) * scaleX, 0, this.cutImage.width));
    const sy = Math.floor(clamp((y - this.cutImageRect.y) * scaleY, 0, this.cutImage.height));
    const sw = Math.max(1, Math.floor(clamp(w * scaleX, 1, this.cutImage.width - sx)));
    const sh = Math.max(1, Math.floor(clamp(h * scaleY, 1, this.cutImage.height - sy)));

    this.cutCanvas.width = this.cutImage.width;
    this.cutCanvas.height = this.cutImage.height;
    this.cutCanvasCtx.clearRect(0, 0, this.cutCanvas.width, this.cutCanvas.height);
    this.cutCanvasCtx.drawImage(this.cutImage, 0, 0);
    const imageData = this.cutCanvasCtx.getImageData(sx, sy, sw, sh);
    const data = imageData.data;

    const paletteColors = this.palette
      .filter((entry) => entry.color)
      .map((entry) => ({ entry, rgb: hexToRgb(entry.color) }));

    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const sampleX = Math.floor(((col + 0.5) / this.gridSize) * sw);
        const sampleY = Math.floor(((row + 0.5) / this.gridSize) * sh);
        const idx = (sampleY * sw + sampleX) * 4;
        const alpha = data[idx + 3] / 255;
        if (alpha < 0.15) {
          this.pixels[row * this.gridSize + col] = null;
          continue;
        }
        const sample = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
        let closest = paletteColors[0]?.entry?.color ?? null;
        let closestDist = Number.POSITIVE_INFINITY;
        paletteColors.forEach((candidate) => {
          const dist = colorDistance(sample, candidate.rgb);
          if (dist < closestDist) {
            closestDist = dist;
            closest = candidate.entry.color;
          }
        });
        this.pixels[row * this.gridSize + col] = closest;
      }
    }
  }

  isPointInBounds(x, y, bounds) {
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  draw(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = '24px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Pixel Editor', 24, 40);

    const leftWidth = 260;
    const bottomHeight = 140;
    const panelPadding = 16;

    const panelX = 20;
    const panelY = 70;
    const panelH = height - bottomHeight - panelY - 20;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(panelX, panelY, leftWidth, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX, panelY, leftWidth, panelH);

    const objectBoxH = 140;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(panelX + 12, panelY + 12, leftWidth - 24, objectBoxH);
    ctx.strokeStyle = this.focus === 'object' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(panelX + 12, panelY + 12, leftWidth - 24, objectBoxH);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Object Selector', panelX + 24, panelY + 34);

    this.objectBounds = [];
    this.objectTypes.forEach((label, index) => {
      const y = panelY + 52 + index * 20;
      const isSelected = index === this.objectIndex;
      ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(label, panelX + 32, y);
      this.objectBounds.push({
        x: panelX + 20,
        y: y - 12,
        w: leftWidth - 40,
        h: 18,
        index
      });
    });

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('Tools', panelX + 24, panelY + 182);

    this.toolBounds = [];
    const toolStartY = panelY + 200;
    const toolListHeight = panelH - toolStartY + panelY - 24;
    const toolGap = 20;
    this.tools.forEach((tool, index) => {
      const y = toolStartY + index * toolGap;
      if (y > toolStartY + toolListHeight - 10) return;
      const isSelected = index === this.toolIndex;
      ctx.fillStyle = isSelected ? '#ffe16a' : 'rgba(255,255,255,0.7)';
      ctx.fillText(tool.label, panelX + 32, y);
      this.toolBounds.push({
        x: panelX + 20,
        y: y - 12,
        w: leftWidth - 40,
        h: 18,
        index
      });
    });

    const canvasX = leftWidth + 60;
    const canvasY = 80;
    const canvasW = width - canvasX - 20;
    const canvasH = height - bottomHeight - canvasY - 20;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
    ctx.strokeStyle = this.focus === 'canvas' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);

    const maxPixelSize = Math.min((canvasW - 40) / this.gridSize, (canvasH - 60) / this.gridSize);
    const pixelSize = Math.min(ZOOM_LEVELS[this.zoomIndex], maxPixelSize);
    const gridW = pixelSize * this.gridSize;
    const gridH = pixelSize * this.gridSize;
    const gridX = canvasX + (canvasW - gridW) / 2;
    const gridY = canvasY + 40;

    this.canvasBounds = { x: gridX, y: gridY, w: gridW, h: gridH, cellSize: pixelSize };

    ctx.fillStyle = '#101010';
    ctx.fillRect(gridX, gridY, gridW, gridH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(gridX, gridY, gridW, gridH);

    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const color = this.pixels[row * this.gridSize + col];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(gridX + col * pixelSize, gridY + row * pixelSize, pixelSize, pixelSize);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i < this.gridSize; i += 1) {
      ctx.beginPath();
      ctx.moveTo(gridX + i * pixelSize, gridY);
      ctx.lineTo(gridX + i * pixelSize, gridY + gridH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gridX, gridY + i * pixelSize);
      ctx.lineTo(gridX + gridW, gridY + i * pixelSize);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(`Zoom: ${pixelSize}px`, canvasX + 20, canvasY + 24);
    ctx.fillText(`Tool: ${this.tools[this.toolIndex]?.label || ''}`, canvasX + 180, canvasY + 24);

    if (this.previewEnabled) {
      const previewSize = 80;
      const previewX = canvasX + canvasW - previewSize - 20;
      const previewY = canvasY + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(previewX, previewY, previewSize, previewSize);
      ctx.strokeStyle = '#ffe16a';
      ctx.strokeRect(previewX, previewY, previewSize, previewSize);
      const previewPixel = previewSize / this.gridSize;
      for (let row = 0; row < this.gridSize; row += 1) {
        for (let col = 0; col < this.gridSize; col += 1) {
          const color = this.pixels[row * this.gridSize + col];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(previewX + col * previewPixel, previewY + row * previewPixel, previewPixel, previewPixel);
        }
      }
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText('Preview', previewX + 8, previewY + previewSize + 16);
    }

    this.cutImageRect = null;
    if (this.cutImage) {
      const cutW = Math.min(canvasW * 0.35, 240);
      const cutH = cutW;
      const cutX = canvasX + 20;
      const cutY = canvasY + canvasH - cutH - 20;
      this.cutBounds = { x: cutX, y: cutY, w: cutW, h: cutH };
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cutX, cutY, cutW, cutH);
      ctx.strokeStyle = this.focus === 'cut' ? '#ffe16a' : 'rgba(255,255,255,0.2)';
      ctx.strokeRect(cutX, cutY, cutW, cutH);
      const scale = Math.min(cutW / this.cutImage.width, cutH / this.cutImage.height);
      const imgW = this.cutImage.width * scale;
      const imgH = this.cutImage.height * scale;
      const imgX = cutX + (cutW - imgW) / 2;
      const imgY = cutY + (cutH - imgH) / 2;
      this.cutImageRect = { x: imgX, y: imgY, w: imgW, h: imgH };
      ctx.drawImage(this.cutImage, imgX, imgY, imgW, imgH);
      if (this.cutSelection) {
        ctx.strokeStyle = '#ffcc6a';
        ctx.strokeRect(this.cutSelection.x, this.cutSelection.y, this.cutSelection.w, this.cutSelection.h);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '12px Courier New';
      ctx.fillText('Cut From Image', cutX + 6, cutY - 6);
    }

    const paletteY = height - bottomHeight + 30;
    const paletteX = 20;
    const paletteW = width - 40;
    const swatchSize = 32;
    const swatchGap = 12;
    const totalSwatchesWidth = this.palette.length * swatchSize + (this.palette.length - 1) * swatchGap;
    let startX = paletteX + (paletteW - totalSwatchesWidth) / 2;
    if (totalSwatchesWidth > paletteW) {
      startX = paletteX;
    }

    this.paletteBounds = [];
    this.palette.forEach((entry, index) => {
      const x = startX + index * (swatchSize + swatchGap);
      const y = paletteY;
      ctx.fillStyle = entry.color || '#101010';
      ctx.fillRect(x, y, swatchSize, swatchSize);
      ctx.strokeStyle = index === this.paletteIndex || this.focus === 'palette' ? '#ffe16a' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(x, y, swatchSize, swatchSize);
      if (!entry.color) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + swatchSize - 4, y + swatchSize - 4);
        ctx.stroke();
      }
      this.paletteBounds.push({ x, y, w: swatchSize, h: swatchSize, index });
    });

    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('Swatches', paletteX + 4, paletteY - 8);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Courier New';
    ctx.fillText('D-pad: select tools/colors • Enter: apply tool • Esc: back', 24, height - 14);

    ctx.restore();
  }
}
