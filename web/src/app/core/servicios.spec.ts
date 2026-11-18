import { describe, expect, it } from 'vitest';
import { etiquetasVisibles } from './servicios';

const s = (clave: string, nombre = clave) => ({ clave, nombre, icono: null });

describe('etiquetasVisibles', () => {
  it('recorta a tres y respeta el orden', () => {
    expect(etiquetasVisibles([s('wifi'), s('desayuno'), s('estacionamiento'), s('alberca')]).map((e) => e.clave)).toEqual(['wifi', 'desayuno', 'estacionamiento']);
  });

  it('pone primero y resalta las que coinciden con el filtro', () => {
    const r = etiquetasVisibles([s('wifi'), s('desayuno'), s('estacionamiento'), s('alberca')], ['alberca']);
    expect(r.map((e) => e.clave)).toEqual(['alberca', 'wifi', 'desayuno']);
    expect(r[0].resaltada).toBe(true);
    expect(r[1].resaltada).toBe(false);
  });

  it('con varios filtros conserva el orden entre las resaltadas', () => {
    expect(etiquetasVisibles([s('a'), s('b'), s('c'), s('d')], ['d', 'b']).map((e) => e.clave)).toEqual(['b', 'd', 'a']);
  });

  it('tolera datos viejos, repetidos o sin nombre', () => {
    expect(etiquetasVisibles(undefined)).toEqual([]);
    expect(etiquetasVisibles(null, ['x'])).toEqual([]);
    expect(etiquetasVisibles([s('wifi'), s('wifi'), { clave: 'x', nombre: '', icono: null }]).map((e) => e.clave)).toEqual(['wifi']);
    expect(etiquetasVisibles([s('a')], [], 0)).toEqual([]);
  });
});
