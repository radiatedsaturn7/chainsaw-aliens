export function createDisposer() {
  const disposers = [];
  let disposed = false;

  const add = (dispose) => {
    if (typeof dispose !== 'function') return () => {};
    if (disposed) {
      try { dispose(); } catch (error) { console.warn('dispose failed after disposer disposed', error); }
      return () => {};
    }
    disposers.push(dispose);
    return () => {
      const index = disposers.indexOf(dispose);
      if (index >= 0) {
        disposers.splice(index, 1);
      }
      try { dispose(); } catch (error) { console.warn('dispose failed', error); }
    };
  };

  const disposeAll = () => {
    if (disposed) return;
    disposed = true;
    while (disposers.length) {
      const dispose = disposers.pop();
      try { dispose(); } catch (error) { console.warn('dispose failed', error); }
    }
  };

  return { add, disposeAll, get disposed() { return disposed; } };
}

export function addDOMListener(target, type, handler, options) {
  if (!target?.addEventListener || !target?.removeEventListener) return () => {};

  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const opts = { ...(options || {}), signal: controller.signal };
    target.addEventListener(type, handler, opts);
    return () => controller.abort();
  }

  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}
