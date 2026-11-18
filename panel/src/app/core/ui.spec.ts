import { describe, expect, it } from 'vitest';
import { variacionPorcentual, variacionPuntos, moverIndice, aPorcentaje, colorAvatar, filtrarComandos, iniciales, puntajeColor, saludo, enlaceLlamar, enlaceWhatsapp, telefonoInternacional } from './ui';

describe('iniciales', () => {
  it('toma dos letras', () => {
    expect(iniciales('Casa Jacaranda')).toBe('CJ');
    expect(iniciales('Taller de Alebrijes Arrazola')).toBe('TD');
    expect(iniciales('Zicatela')).toBe('ZI');
    expect(iniciales('  ')).toBe('?');
    expect(iniciales(null)).toBe('?');
    expect(iniciales('"Doña" Chela')).toBe('DC');
  });
});

describe('avatar y puntaje', () => {
  it('es estable', () => {
    expect(colorAvatar('Casa Jacaranda')).toEqual(colorAvatar('Casa Jacaranda'));
    expect(colorAvatar(null).fondo).toMatch(/^#/);
  });
  it('colores y límites', () => {
    expect(puntajeColor(92)).toBe('var(--sierra)');
    expect(puntajeColor(64)).toBe('var(--ocre)');
    expect(puntajeColor(31)).toBe('var(--grana)');
    expect(aPorcentaje(140)).toBe(100);
    expect(aPorcentaje(-3)).toBe(0);
    expect(aPorcentaje(NaN)).toBe(0);
  });
});

describe('saludo', () => {
  it('según la hora', () => {
    expect(saludo(8)).toBe('Buenos días');
    expect(saludo(15)).toBe('Buenas tardes');
    expect(saludo(22)).toBe('Buenas noches');
    expect(saludo(2)).toBe('Buenas noches');
  });
});

describe('ir a…', () => {
  const lista = [
    { texto: 'Cola', grupo: 'Revisión', ruta: '/revision' },
    { texto: 'Moderación', grupo: 'Comunidad', ruta: '/comunidad' },
    { texto: 'Planes y precios', grupo: 'Negocios y cobros', ruta: '/catalogo' },
  ];
  it('ignora acentos, mayúsculas y orden', () => {
    expect(filtrarComandos(lista, 'moderacion').map((c) => c.ruta)).toEqual(['/comunidad']);
    expect(filtrarComandos(lista, 'PRECIOS planes').map((c) => c.ruta)).toEqual(['/catalogo']);
    expect(filtrarComandos(lista, 'revision').map((c) => c.ruta)).toEqual(['/revision']);
    expect(filtrarComandos(lista, 'zzz')).toEqual([]);
    expect(filtrarComandos(lista, '  ')).toHaveLength(3);
  });
});

describe('moverIndice', () => {
  it('no se sale de la lista', () => {
    expect(moverIndice(0, -1, 5)).toBe(0);
    expect(moverIndice(4, 1, 5)).toBe(4);
    expect(moverIndice(2, 1, 5)).toBe(3);
    expect(moverIndice(3, 0, 0)).toBe(0);
  });
});

describe('variación frente al periodo anterior', () => {
  it('porcentaje', () => {
    expect(variacionPorcentual(112, 100)).toEqual({ texto: '▲ 12 % vs. periodo anterior', tono: 'sube' });
    expect(variacionPorcentual(97, 100)?.tono).toBe('baja');
    expect(variacionPorcentual(100, 100)?.tono).toBe('igual');
    expect(variacionPorcentual(50, 0)).toBeNull();
    expect(variacionPorcentual(50, null)).toBeNull();
  });
  it('puntos de tasa', () => {
    expect(variacionPuntos(0.074, 0.07)?.texto).toBe('▲ 0.4 puntos');
    expect(variacionPuntos(0.06, 0.07)?.tono).toBe('baja');
    expect(variacionPuntos(null, 0.07)).toBeNull();
  });
});

describe('teléfonos', () => {
  it('10 dígitos llevan la lada 52', () => {
    expect(telefonoInternacional('951 555 0142')).toBe('529515550142');
    expect(enlaceWhatsapp('(951) 555-0142')).toBe('https://wa.me/529515550142');
    expect(enlaceLlamar('951 555 0142')).toBe('tel:+529515550142');
  });
  it('acepta +52 y el antiguo 521', () => {
    expect(telefonoInternacional('+529541181886')).toBe('529541181886');
    expect(telefonoInternacional('+52 1 954 118 1886')).toBe('529541181886');
  });
  it('lo que no se entiende no ofrece botón', () => {
    expect(telefonoInternacional('555')).toBeNull();
    expect(telefonoInternacional('+1 202 555 0100')).toBeNull();
    expect(telefonoInternacional(null)).toBeNull();
    expect(enlaceWhatsapp('')).toBeNull();
    expect(enlaceLlamar(undefined)).toBeNull();
  });
});
