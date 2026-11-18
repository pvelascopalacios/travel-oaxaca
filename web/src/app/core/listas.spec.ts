import { describe, expect, it } from 'vitest';
import { ListaElemento } from './modelos';
import { agruparPorDia, diasDeItinerario, entradaDeLista, estadoResena, fechaDelDia, moverEnGrupo, rangoFechas, validarLista } from './listas';

const el = (itemId: string, dia: number | null, orden: number, nombre = itemId): ListaElemento => ({ itemId, tipo: 'negocio', id: 'x' + itemId, slug: itemId, nombre, dia, orden, nota: null, imagenUrl: null });

describe('listas', () => {
  it('valida el formulario', () => {
    expect(validarLista('Mi viaje', false, '', '')).toEqual({});
    expect(validarLista('  ', false, '', '')).toEqual({ nombre: 'listaNombreVacio' });
    expect(validarLista('x'.repeat(81), false, '', '')).toEqual({ nombre: 'listaNombreLargo' });
    expect(validarLista('V', true, '2026-11-16', '2026-11-14')).toEqual({ fechaFin: 'listaFechasInvertidas' });
    // En una lista normal las fechas no cuentan.
    expect(validarLista('V', false, '2026-11-16', '2026-11-14')).toEqual({});
    expect(validarLista('V', true, '2026-11-14', '')).toEqual({});
  });

  it('no manda fechas si no es itinerario', () => {
    expect(entradaDeLista(' Viaje ', false, '2026-11-14', '2026-11-16', true)).toEqual({ nombre: 'Viaje', esItinerario: false, fechaInicio: null, fechaFin: null, publica: true });
    expect(entradaDeLista('Viaje', true, '2026-11-14', '', false)).toEqual({ nombre: 'Viaje', esItinerario: true, fechaInicio: '2026-11-14', fechaFin: null, publica: false });
  });

  it('cuenta los días y calcula la fecha de cada uno', () => {
    expect(diasDeItinerario('2026-11-14', '2026-11-16')).toBe(3);
    expect(diasDeItinerario('2026-11-14', '2026-11-14')).toBe(1);
    expect(diasDeItinerario('2026-11-16', '2026-11-14')).toBeNull();
    expect(diasDeItinerario(null, '2026-11-14')).toBeNull();
    expect(fechaDelDia('2026-11-14', 1)).toBe('2026-11-14');
    expect(fechaDelDia('2026-11-30', 2)).toBe('2026-12-01');
    expect(fechaDelDia(null, 1)).toBeNull();
  });

  it('agrupa un itinerario por día, con días vacíos y los sueltos al final', () => {
    const g = agruparPorDia([el('a', 1, 1), el('b', 1, 0), el('c', null, 0), el('d', 3, 0)], true, '2026-11-14', '2026-11-15');
    expect(g.map((x) => x.dia)).toEqual([1, 2, 3, null]);
    expect(g[0].elementos.map((e) => e.itemId)).toEqual(['b', 'a']);
    expect(g[1].elementos).toEqual([]);
    expect(g[0].fecha).toBe('2026-11-14');
    expect(g[3].elementos.map((e) => e.itemId)).toEqual(['c']);
  });

  it('una lista normal es un solo grupo; un itinerario sin nada deja el grupo «sin día»', () => {
    const g = agruparPorDia([el('a', null, 2), el('b', null, 1)], false, null, null);
    expect(g).toHaveLength(1);
    expect(g[0].elementos.map((e) => e.itemId)).toEqual(['b', 'a']);
    expect(agruparPorDia([], true, null, null)).toEqual([{ dia: null, fecha: null, elementos: [] }]);
  });

  it('mueve un elemento dentro de su grupo y renumera', () => {
    const grupo = [el('a', 1, 0), el('b', 1, 1), el('c', 1, 2)];
    expect(moverEnGrupo(grupo, 'b', -1)).toEqual([{ itemId: 'b', orden: 0 }, { itemId: 'a', orden: 1 }]);
    expect(moverEnGrupo(grupo, 'a', -1)).toEqual([]);
    expect(moverEnGrupo(grupo, 'c', 1)).toEqual([]);
    expect(moverEnGrupo(grupo, 'zzz', 1)).toEqual([]);
    // Órdenes repetidos o con huecos: el resultado queda 0,1,2 sin repetir.
    const raro = [el('a', null, 5, 'A'), el('b', null, 5, 'B'), el('c', null, 9)];
    const c = moverEnGrupo(raro, 'b', -1);
    expect(c.find((x) => x.itemId === 'b')?.orden).toBe(0);
    expect(c.find((x) => x.itemId === 'a')?.orden).toBe(1);
  });

  it('arma el rango de fechas', () => {
    const f = (iso: string) => iso.slice(5);
    expect(rangoFechas('2026-11-14', '2026-11-16', f)).toBe('11-14 – 11-16');
    expect(rangoFechas('2026-11-14', '2026-11-14', f)).toBe('11-14');
    expect(rangoFechas('2026-11-14', null, f)).toBe('11-14');
    expect(rangoFechas(null, null, f)).toBeNull();
  });

  it('traduce el estado de una reseña propia', () => {
    expect(estadoResena('publicada')).toEqual({ clave: 'misResenasPublicada', clase: 'ok' });
    expect(estadoResena('pendiente').clase).toBe('espera');
    expect(estadoResena('oculta').clase).toBe('no');
    expect(estadoResena('rechazada').clase).toBe('no');
    expect(estadoResena(null).clase).toBe('ok');
  });
});
