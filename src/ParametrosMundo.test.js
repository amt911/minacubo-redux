// @ts-check
import { describe, it, expect } from 'vitest';
import { ParametrosMundo, PIXELES_ESTANDAR } from './ParametrosMundo.js';

describe('ParametrosMundo', () => {
  it('PIXELES_ESTANDAR named export es 16', () => {
    expect(PIXELES_ESTANDAR).toBe(16);
  });

  it('ParametrosMundo.PIXELES_ESTANDAR static es 16', () => {
    expect(ParametrosMundo.PIXELES_ESTANDAR).toBe(16);
  });

  it('named export y static estan sincronizados', () => {
    expect(PIXELES_ESTANDAR).toBe(ParametrosMundo.PIXELES_ESTANDAR);
  });
});
