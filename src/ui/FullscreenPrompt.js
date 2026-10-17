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

  show() {
    if (this.active) return;
    this.active = true;
    this.awaitingRelease = false;
    return this.open({
      title: 'Full screen', confirmText: 'OK', cancelText: 'Cancel',
      initialFocus: 'confirm', confirmFirst: true,
      onConfirm: this.request,
      onOpen: buttons => { this.buttons = buttons; }
    }).finally(() => {
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
