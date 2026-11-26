const STUDIO_URL = new URL('../../../ui/surfaceStudio/index.html', import.meta.url);
const EXIT_EVENT = 'lotg-surface-studio-exit';

export default class SurfaceStudioState {
  constructor(game) {
    this.game = game;
    this.draft = null;
  }

  enter() {
    if (typeof document === 'undefined') return;
    const frame = document.createElement('iframe');
    frame.id = 'surface-studio-frame';
    frame.title = '3D Car Design';
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;display:block;z-index:12000;background:#11171f';
    this.frame = frame;
    const fallback = document.createElement('button');
    fallback.type = 'button';
    fallback.textContent = '‹ Graphics';
    fallback.style.cssText = 'position:fixed;right:12px;top:12px;z-index:12001;min-height:44px;padding:0 16px;background:#192330;color:#e7edf5;border:1px solid #4f908c;border-radius:6px';
    this.loadBack = fallback;
    this.onBack = () => this.game.exitSurfaceStudio();
    fallback.addEventListener('click', this.onBack);
    this.onLoad = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.addEventListener(EXIT_EVENT, this.onBack);
      const tool = frame.contentWindow?.designer;
      if (tool) {
        fallback.remove();
        if (this.draft) tool.applyGenome(this.draft, {fit:true});
      }
      frame.contentWindow?.focus();
    };
    frame.addEventListener('load', this.onLoad);
    frame.src = STUDIO_URL.href;
    document.body.append(frame, fallback);
  }

  exit() {
    const frame = this.frame;
    if (!frame) return;
    try {
      this.draft = frame.contentWindow?.designer?.getGenome() ?? this.draft;
      frame.contentDocument?.removeEventListener(EXIT_EVENT, this.onBack);
    } finally {
      frame.removeEventListener('load', this.onLoad);
      frame.remove();
      this.loadBack?.remove();
      this.loadBack = null;
      this.frame = null;
    }
  }

  update(dt) {
    this.game.updateActiveMusicPlayers(dt);
    if (this.game.input.wasPressed('cancel') || this.game.input.wasPressed('editor')) {
      this.game.exitSurfaceStudio();
    }
    this.game.input.flush();
  }
}
