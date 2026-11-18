import { describe, expect, it } from 'vitest';
import { capitalizar, categoriaDe, interpretar, normalizar, ordenarMunicipios } from './consulta';
import { Categoria } from './modelos';

const c = (id: string, clave: string, nombre: string, hijas: Categoria[] = [], padreId: string | null = null): Categoria => ({ id, padreId, clave, nombre, hijas });
const ARBOL: Categoria[] = [
  c('1', 'hospedaje', 'Hospedaje', [c('1a', 'hotel', 'Hotel', [], '1'), c('1b', 'posada', 'Posada', [], '1')]),
  c('2', 'comida', 'Comida', [c('2a', 'fonda', 'Fonda', [], '2'), c('2b', 'restaurante', 'Restaurante', [], '2')]),
  c('3', 'tours', 'Tours', [c('3a', 'tour_dia', 'Tour de un día', [], '3')]),
];

describe('interpretar', () => {
  it('separa qué y dónde con «en»', () => {
    expect(interpretar('hoteles en huaju')).toEqual({ que: 'hoteles', donde: 'huaju' });
    expect(interpretar('  Mezcal   EN   Huajuapan de León ')).toEqual({ que: 'Mezcal', donde: 'Huajuapan de León' });
  });
  it('acepta «in» en inglés', () => {
    expect(interpretar('hotels in huatulco')).toEqual({ que: 'hotels', donde: 'huatulco' });
  });
  it('sin «en» deja todo como búsqueda', () => {
    expect(interpretar('mezcal')).toEqual({ que: 'mezcal', donde: null });
    expect(interpretar('san pedro en')).toEqual({ que: 'san pedro en', donde: null });
    expect(interpretar('en huajuapan')).toEqual({ que: 'en huajuapan', donde: null });
  });
  it('no parte palabras que contienen «en»', () => {
    expect(interpretar('centro historico')).toEqual({ que: 'centro historico', donde: null });
  });
});

describe('categoriaDe', () => {
  it('hoteles → Dormir, tipo hotel', () => {
    const r = categoriaDe('hoteles', ARBOL)!;
    expect(r.grupo.clave).toBe('dormir');
    expect(r.tipos).toEqual(['hotel']);
  });
  it('dormir → todo el grupo Dormir', () => {
    const r = categoriaDe('dormir', ARBOL)!;
    expect(r.grupo.clave).toBe('dormir');
    expect(r.tipos).toEqual([]);
  });
  it('restaurantes y dónde comer → Comer y beber', () => {
    expect(categoriaDe('restaurantes', ARBOL)!.tipos).toEqual(['restaurante']);
    expect(categoriaDe('Dónde comer', ARBOL)!.grupo.clave).toBe('comer');
  });
  it('reconoce por el nombre de la categoría', () => {
    expect(categoriaDe('fondas', ARBOL)!.tipos).toEqual(['fonda']);
  });
  it('lo desconocido da null', () => {
    expect(categoriaDe('mezcal', ARBOL)).toBeNull();
    expect(categoriaDe('', ARBOL)).toBeNull();
  });
});

describe('normalizar y capitalizar', () => {
  it('quita acentos', () => {
    expect(normalizar('Huajuapan de León')).toBe('huajuapan de leon');
    expect(capitalizar('hoteles')).toBe('Hoteles');
  });
});

describe('ordenarMunicipios', () => {
  it('primero el nombre igual, luego los que empiezan igual', () => {
    const l = [{ nombre: 'San Juan Oaxaca' }, { nombre: 'Oaxaca de Juárez' }, { nombre: 'Oaxaca' }];
    expect(ordenarMunicipios(l, 'oaxaca').map((m) => m.nombre)).toEqual(['Oaxaca', 'Oaxaca de Juárez', 'San Juan Oaxaca']);
  });
  it('conserva el orden entre iguales y no pierde elementos', () => {
    const l = [{ nombre: 'B' }, { nombre: 'A' }];
    expect(ordenarMunicipios(l, 'zz')).toEqual(l);
  });
});
