// @ts-check
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

const SKY_COLOR  = new THREE.Color(0x87CEEB);
const NIGHT_COLOR = new THREE.Color(0x000000);
const CYCLE_MS = 60_000;

/**
 * Drives the day/night TWEEN cycle: animates fog, background colour, and
 * light intensities between sky-blue day and black night over CYCLE_MS ms,
 * then yoyo-repeats indefinitely.
 */
export class DayNightCycle {
  /**
   * @param {THREE.Scene} scene       - scene whose .background is updated
   * @param {THREE.Fog} fog           - scene fog colour target
   * @param {THREE.HemisphereLight} hemi  - ambient hemisphere light
   * @param {THREE.DirectionalLight} sun  - directional sun light
   */
  constructor(scene, fog, hemi, sun) {
    this._bgColor = new THREE.Color(SKY_COLOR);

    const rgb = {
      r: SKY_COLOR.r,
      g: SKY_COLOR.g,
      b: SKY_COLOR.b,
      intensidad: 1,
    };

    new TWEEN.Tween(rgb)
      .to({ r: NIGHT_COLOR.r, g: NIGHT_COLOR.g, b: NIGHT_COLOR.b, intensidad: 0 }, CYCLE_MS)
      .onUpdate(() => {
        fog.color.setRGB(rgb.r, rgb.g, rgb.b);
        this._bgColor.setRGB(rgb.r, rgb.g, rgb.b);
        scene.background = this._bgColor;
        hemi.intensity = rgb.intensidad * 0.3;
        // Sun never drops below 0.5 so shadows stay visible at "night".
        sun.intensity = 0.5 + rgb.intensidad * 1.1;
      })
      .yoyo(true)
      .repeat(Infinity)
      .start();
  }

  /** Call once per frame from the game loop. */
  update() {
    TWEEN.update();
  }
}
