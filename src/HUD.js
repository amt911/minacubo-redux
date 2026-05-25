// @ts-check

/**
 * DOM-based HUD: health hearts, damage flash, game-over overlay.
 * No Three.js — pure DOM so it always renders on top without z-fighting.
 */
export class HUD {
  constructor() {
    this._gameOverShown = false;
    this._flashTimer = 0;
    this._createHealthBar();
    this._createDamageFlash();
    this._createGameOver();
  }

  _createHealthBar() {
    const bar = document.createElement('div');
    bar.id = 'hud-health';
    bar.style.cssText =
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:3px;pointer-events:none;z-index:200';
    document.body.appendChild(bar);
    this._healthBar = bar;

    /** @type {HTMLSpanElement[]} */
    this._hearts = [];
    for (let i = 0; i < 10; i++) {
      const h = document.createElement('span');
      h.style.cssText =
        'font-size:26px;line-height:1;' +
        'filter:drop-shadow(1px 1px 0 #000);transition:color 0.1s';
      h.textContent = '❤';
      bar.appendChild(h);
      this._hearts.push(h);
    }
  }

  _createDamageFlash() {
    const flash = document.createElement('div');
    flash.id = 'hud-damage-flash';
    flash.style.cssText =
      'position:fixed;inset:0;background:rgba(200,0,0,0);pointer-events:none;' +
      'transition:background 0.12s ease-out;z-index:300';
    document.body.appendChild(flash);
    this._flash = flash;
  }

  _createGameOver() {
    const overlay = document.createElement('div');
    overlay.id = 'hud-gameover';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.78);color:#fff;' +
      'display:none;flex-direction:column;align-items:center;justify-content:center;' +
      'font-family:sans-serif;z-index:400';
    overlay.innerHTML =
      '<h1 style="color:#c00;font-size:3em;margin:0 0 0.3em;' +
      'text-shadow:2px 2px 6px #000">Has muerto</h1>' +
      '<p style="opacity:0.7;margin:0 0 1.2em;font-size:1.1em">El zombie te ha vencido</p>' +
      '<button id="hud-respawn-btn" style="font-size:1.3em;padding:0.45em 1.4em;' +
      'cursor:pointer;background:#4a4a4a;color:#fff;border:2px solid #aaa;' +
      'border-radius:5px;letter-spacing:0.05em">Respawn</button>';
    document.body.appendChild(overlay);
    this._gameOver = overlay;
    this._respawnBtn = /** @type {HTMLButtonElement} */ (
      overlay.querySelector('#hud-respawn-btn')
    );
  }

  /**
   * Call every frame with current player health.
   * @param {number} health  current HP
   * @param {number} maxHealth  max HP (must be even, ≤ 20)
   */
  update(health, maxHealth) {
    const totalHearts = maxHealth / 2;
    // hearts in [0, totalHearts] units, each heart = 2 HP
    const filledHearts = Math.max(0, health) / 2;

    for (let i = 0; i < this._hearts.length; i++) {
      if (i >= totalHearts) {
        this._hearts[i].style.display = 'none';
        continue;
      }
      this._hearts[i].style.display = '';
      if (i < Math.floor(filledHearts)) {
        this._hearts[i].style.color = '#e00';   // full
      } else if (i < filledHearts) {
        this._hearts[i].style.color = '#c66';   // half (not used with integer HP)
      } else {
        this._hearts[i].style.color = '#444';   // empty
      }
    }
  }

  /** Brief red vignette on hit. */
  flashDamage() {
    this._flash.style.transition = 'none';
    this._flash.style.background = 'rgba(200,0,0,0.40)';
    // force reflow so the instant-on lands before the fade-out transition
    void this._flash.offsetWidth;
    this._flash.style.transition = 'background 0.35s ease-out';
    this._flash.style.background = 'rgba(200,0,0,0)';
  }

  /**
   * Show the "You died" overlay.
   * @param {() => void} onRespawn called when player presses the button
   */
  showGameOver(onRespawn) {
    if (this._gameOverShown) return;
    this._gameOverShown = true;
    this._gameOver.style.display = 'flex';
    this._respawnBtn.onclick = () => {
      this._gameOver.style.display = 'none';
      this._gameOverShown = false;
      onRespawn();
    };
  }

  get gameOverShown() {
    return this._gameOverShown;
  }
}
