import '../../estilo.css';

// The game has no component library to isolate — MyScene.js is a god class that
// owns the whole DOM/game loop, and everything else is either a Three.js mesh or
// pure logic. The one real, isolatable UI/HUD piece is the "click to play"
// pointer-lock overlay (index.html's #pointer-lock-overlay, shown/hidden by
// MyScene.js via the `body.pointer-locked` class). This story renders that exact
// markup against the real stylesheet (estilo.css) — no Three.js, no game loop,
// no backend/env needed.
function renderOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'pointer-lock-overlay';
  overlay.innerHTML = `
    <p>Haz clic para jugar</p>
    <p class="hint">ESC para liberar el ratón · Arrastre derecho si no hay captura</p>
  `;
  // estilo.css positions the overlay absolutely (inset: 0) over its container —
  // give the Storybook canvas a sized, relatively-positioned host to land in.
  const host = document.createElement('div');
  host.style.position = 'relative';
  host.style.width = '480px';
  host.style.height = '320px';
  host.style.background = '#2b2b2b';
  host.appendChild(overlay);
  return host;
}

export default {
  title: 'UI/PointerLockOverlay',
  tags: ['autodocs'],
};

export const ClickToPlay = {
  render: renderOverlay,
};
