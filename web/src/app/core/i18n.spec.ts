import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GRUPOS, grupoPorRuta } from './grupos';
import { I18n } from './i18n';
import { TEXTOS } from './textos';

describe('I18n', () => {
  it('cambia de idioma solo con idiomas válidos', () => {
    const i18n = TestBed.inject(I18n);
    i18n.fijar('en');
    expect(i18n.t('grupoDormir')).toBe('Stay');
    i18n.fijar('fr');
    expect(i18n.lang()).toBe('en');
    i18n.fijar('es');
    expect(i18n.t('grupoDormir')).toBe('Dormir');
  });

  it('tiene los mismos textos en español e inglés', () => {
    expect(Object.keys(TEXTOS.en).sort()).toEqual(Object.keys(TEXTOS.es).sort());
    for (const idioma of ['es', 'en'] as const) {
      for (const [clave, texto] of Object.entries(TEXTOS[idioma])) {
        expect(texto.trim(), `${idioma}.${clave}`).not.toBe('');
      }
    }
  });

  it('traduce claves armadas y deja el valor si no existe', () => {
    const i18n = TestBed.inject(I18n);
    i18n.fijar('es');
    expect(i18n.tDinamico('tipo', 'playa')).toBe('Playa');
    expect(i18n.tDinamico('tipo', 'inventado')).toBe('inventado');
    expect(i18n.tDinamico('tipo', null)).toBe('');
  });

  it('da formato a fechas y precios según el idioma', () => {
    const i18n = TestBed.inject(I18n);
    i18n.fijar('es');
    expect(i18n.fecha('2026-12-02')).toContain('dic');
    expect(i18n.precio(850, 'MXN')).toContain('850');
  });
});

describe('Grupos', () => {
  it('son cuatro, con rutas únicas y cada categoría principal en un solo grupo', () => {
    expect(GRUPOS).toHaveLength(4);
    expect(new Set(GRUPOS.map((g) => g.ruta)).size).toBe(4);
    const raices = GRUPOS.flatMap((g) => g.raices);
    expect(new Set(raices).size).toBe(raices.length);
    expect(raices.sort()).toEqual(['comida', 'compras', 'hospedaje', 'tours', 'vida_nocturna']);
  });

  it('encuentra el grupo por su ruta', () => {
    expect(grupoPorRuta('comer-y-beber')?.clave).toBe('comer');
    expect(grupoPorRuta('nada')).toBeUndefined();
  });
});
