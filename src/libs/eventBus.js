// @ts-check

/**
 * Minimal typed event bus.
 * Usage:
 *   bus.on('blockRemoved', ({ x, y, z }) => { ... });
 *   bus.emit('blockRemoved', { x: 1, y: 2, z: 3 });
 *   bus.off('blockRemoved', handler);
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /** @param {string} event @param {Function} fn */
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return this;
  }

  /** @param {string} event @param {Function} fn */
  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
    return this;
  }

  /** @param {string} event @param {*} [data] */
  emit(event, data) {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }
}

export const bus = new EventBus();
