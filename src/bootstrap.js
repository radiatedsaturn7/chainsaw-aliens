import { FullscreenPrompt } from './ui/FullscreenPrompt.js';

// Keep this entry point independent of Game and its editor/module graph. The
// HTML loading message is visible while those much larger downloads arrive.
const splash = document.getElementById('studio-boot');
const status = document.getElementById('studio-boot-status');
const retry = document.getElementById('studio-boot-retry');
let ready = false;
function fail(error) {
  if (ready) return;
  status.textContent = 'RTG Studio could not load. Check your connection and reload.';
  retry.hidden = false;
  console.error('RTG Studio startup failed', error);
}
const onError = event => fail(event.error || event.reason || event.message);
window.addEventListener('error', onError, true);
window.addEventListener('unhandledrejection', onError);
retry.addEventListener('click', () => location.reload());
const boot = window.__rtgBoot = {
  fullscreenPromptShown: false,
  ready() {
    if (ready) return;
    ready = true;
    splash.remove();
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onError);
  }
};
const mobile = typeof navigator.userAgentData?.mobile === 'boolean'
  ? navigator.userAgentData.mobile
  : /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    || (matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches && matchMedia('(max-width: 900px)').matches);
if (mobile && !new URLSearchParams(location.search).has('hideFullscreenForTesting')
    && !document.fullscreenElement && document.documentElement.requestFullscreen) {
  boot.fullscreenPromptShown = true;
  boot.fullscreenPrompt = new FullscreenPrompt(() => {
    // This must remain inside the OK click's user activation.
    void document.documentElement.requestFullscreen().catch(() => {});
  });
  void boot.fullscreenPrompt.show();
}
