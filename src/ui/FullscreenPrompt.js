import { openConfirmOverlay } from './shared/textInputOverlay.js';

export class FullscreenPrompt {
  constructor(request, open = openConfirmOverlay) {
    this.request = request;
    this.open = open;
    this.active = false;
    this.buttons = null;
    this.awaitingRelease = false;
  }

  get blocksInput() { return this.active || this.awaitingRelease; }

  // A loading screen may render for many frames. Offer once per load, even
  // when the player cancels or fullscreen is already active at its start.
  showForLoading(load, { fullscreen = false, supported = true, hidden = false } = {}) {
    if (!load) {
      this.loadingPromptToken = null;
      return;
    }
    if (this.loadingPromptToken === load) return;
    this.loadingPromptToken = load;
    if (fullscreen || !supported || hidden || this.blocksInput) return;
    return this.show();
  }

  show() {
    if (this.active) return;
    this.active = true;
    this.awaitingRelease = false;
    let detachViewport = () => {};
    return this.open({
      title: 'Full screen', confirmText: 'OK', cancelText: 'Cancel',
      initialFocus: 'confirm', confirmFirst: true,
      onConfirm: this.request,
      onOpen: buttons => {
        this.buttons = buttons;
        // Mobile browser chrome, zoom, and rotation can leave the layout
        // viewport larger than the visible screen. Keep both buttons visible.
        const win = globalThis.window;
        const viewport = win?.visualViewport;
        const fit = () => {
          if (!viewport || !buttons.overlay) return;
          Object.assign(buttons.overlay.style, {
            inset: 'auto', left: `${viewport.offsetLeft || 0}px`,
            top: `${viewport.offsetTop || 0}px`, width: `${viewport.width}px`,
            height: `${viewport.height}px`, boxSizing: 'border-box', overflow: 'auto'
          });
        };
        fit();
        viewport?.addEventListener('resize', fit);
        viewport?.addEventListener('scroll', fit);
        win?.addEventListener('resize', fit);
        detachViewport = () => {
          viewport?.removeEventListener('resize', fit);
          viewport?.removeEventListener('scroll', fit);
          win?.removeEventListener('resize', fit);
        };
      }
    }).finally(() => {
      detachViewport();
      this.active = false;
      this.buttons = null;
      this.awaitingRelease = true;
      this.onClose?.();
    });
  }

  update(input) {
    if (this.awaitingRelease) {
      const heldButton = ['jump','gamepadA','gamepadStart','pause','gamepadB','cancel','dash']
        .some(action => input?.isGamepadDown?.(action));
      const heldKey = ['Enter','Space','Escape'].some(code => input?.isDownCode?.(code));
      if (!heldButton && !heldKey) this.awaitingRelease = false;
      // Drain virtual action edges too: on resume GameCore rebuilds those
      // from held gamepad buttons, independently of the raw pressed set.
      input?.clearVirtual?.();
      input?.flush?.();
      return;
    }
    if (!this.active || !this.buttons) return;
    const {okBtn, cancelBtn} = this.buttons;
    const pressed = action => input?.wasGamepadPressed?.(action);
    const selected = () => document.activeElement === cancelBtn ? cancelBtn : okBtn;
    if (['dpadLeft','dpadRight','dpadUp','dpadDown','left','right','up','down'].some(pressed)) {
      (selected() === okBtn ? cancelBtn : okBtn).focus({preventScroll:true});
    }
    if (pressed('gamepadB') || pressed('cancel')) cancelBtn.click();
    else if (pressed('jump') || pressed('gamepadStart')) selected().click();
  }
}
