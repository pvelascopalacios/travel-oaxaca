import { describe, expect, it } from 'vitest';
import { PlanPublico } from './modelos';
import { enlacePortal, ordenarPlanes, periodosDisponibles, precioVisible } from './planes';

const plan = (clave: string, fotos: number, ofertas: number, extra: Partial<PlanPublico> = {}): PlanPublico => ({
  clave, nombre: clave, limiteFotos: fotos, limiteOfertas: ofertas, veEstadisticas: false, permitePromociones: false, permitePatrocinio: false, precios: [], ...extra,
});
const precio = (periodo: string, monto: number, extra: object = {}) => ({ planClave: 'x', destinoId: null, categoriaId: null, periodo, monto, moneda: 'MXN', ...extra });

describe('planes', () => {
  it('ordena del que menos incluye al que más', () => {
    const l = ordenarPlanes([plan('destacado', 30, 30, { veEstadisticas: true, permitePatrocinio: true }), plan('gratis', 3, 0), plan('pro', 15, 10, { veEstadisticas: true })]);
    expect(l.map((p) => p.clave)).toEqual(['gratis', 'pro', 'destacado']);
  });
  it('periodos con precio, el anual primero', () => {
    expect(periodosDisponibles([plan('gratis', 3, 0), plan('pro', 15, 10, { precios: [precio('mensual', 75), precio('anual', 600)] })])).toEqual(['anual', 'mensual']);
    expect(periodosDisponibles([plan('pro', 15, 10, { precios: [precio('mensual', 75)] })])).toEqual(['mensual']);
    expect(periodosDisponibles([plan('gratis', 3, 0)])).toEqual([]);
  });
  it('prefiere el precio general y si no, el más bajo con «desde»', () => {
    expect(precioVisible({ precios: [precio('anual', 900, { categoriaId: 'c' }), precio('anual', 600)] }, 'anual')).toEqual({ monto: 600, moneda: 'MXN', desde: false });
    expect(precioVisible({ precios: [precio('anual', 900, { categoriaId: 'a' }), precio('anual', 700, { destinoId: 'd' })] }, 'anual')).toEqual({ monto: 700, moneda: 'MXN', desde: true });
    expect(precioVisible({ precios: [precio('mensual', 75)] }, 'anual')).toBeNull();
  });
  it('arma el enlace al portal', () => {
    expect(enlacePortal('http://localhost:4300/', 'registro')).toBe('http://localhost:4300/ingresar?modo=registro');
    expect(enlacePortal('https://portal.x.mx', 'ingreso')).toBe('https://portal.x.mx/ingresar');
  });
});
