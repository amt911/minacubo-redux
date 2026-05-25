// @ts-check

/**
 * Owns keyboard state and block-selection wheel logic.
 * Pointer-lock camera control remains in MyScene (camera-system coupled).
 */
export class InputHandler {
  /**
   * @param {{
   *   onPlayerReset: () => void,
   *   onMouseDown: (e: MouseEvent) => void,
   *   onMouseUp: (e: MouseEvent) => void,
   * }} opts
   */
  constructor(opts) {
    this._onPlayerReset = opts.onPlayerReset;
    this._onMouseDown   = opts.onMouseDown;
    this._onMouseUp     = opts.onMouseUp;

    /** @type {Record<string, boolean>} */
    this.keyMap = { W: false, A: false, D: false, S: false, ' ': false, SHIFT: false };

    /** Currently selected block index (0-based) */
    this.selectedBlockIndex = 0;

    this._registerListeners();
  }

  _registerListeners() {
    const clearAll = () => {
      for (const k in this.keyMap) this.keyMap[k] = false;
      this._onPlayerReset();
    };

    window.addEventListener('keydown', (e) => {
      this.keyMap[e.key.toUpperCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keyMap[e.key.toUpperCase()] = false;
      e.stopImmediatePropagation();
      if (Object.values(this.keyMap).every(v => !v)) this._onPlayerReset();
    });

    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAll();
    });

    window.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => this._onWheel(e));
  }

  /** @param {WheelEvent} event */
  _onWheel(event) {
    const tiles = /** @type {HTMLCollectionOf<HTMLElement>} */ (
      document.getElementsByClassName('tile')
    );
    if (tiles.length === 0) return;

    tiles[this.selectedBlockIndex].style.border = '';

    if (event.deltaY > 0) {
      this.selectedBlockIndex = (this.selectedBlockIndex + 1) % tiles.length;
    } else {
      this.selectedBlockIndex = this.selectedBlockIndex === 0
        ? tiles.length - 1
        : this.selectedBlockIndex - 1;
    }

    tiles[this.selectedBlockIndex].style.border = '3px solid black';
  }
}
