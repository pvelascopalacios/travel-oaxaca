import { describe, expect, it } from 'vitest';
import { Cupon, Suscripcion } from './modelos';
import {
  accionesDePago, activarParaApi, alcancePrecio, aNumero, calcularCobro, cuponVigente, errorDeActivar, errorDeCupon, errorDePlan, errorDePrecio, estadoPrecio, formActivarVacio, formCuponVacio,
  sumarPeriodo, suscripcionVigente, verificacionParaApi, verificacionVigente, vigenciaNueva, valorCuponTexto, categoriasConRuta, dinero, formPrecioVacio,
} from './cobros';

const cup = (tipo: string, valor: number): Cupon => ({ id: 'c', codigo: 'X', descripcion: null, tipo, valor, aplicaA: 'suscripcion', maxUsos: null, usos: 0, vigenteDesde: null, vigenteHasta: null });
const sus = (planClave: string, estado: string, fin: string): Suscripcion => ({ id: planClave + fin, negocioId: 'n', planClave, planNombre: planClave, estado, inicio: '2026-01-01', fin, graciaHasta: null, periodo: 'anual', monto: 100, canceladaEn: null, motivoCancelacion: null });

describe('números y fechas', () => {
  it('aNumero', () => {
    expect(aNumero('1,234.50')).toBe(1234.5);
    expect(aNumero(' $299 ')).toBe(299);
    expect(aNumero('')).toBeNull();
    expect(aNumero('abc')).toBeNull();
  });
  it('sumar periodos como Java', () => {
    expect(sumarPeriodo('2026-01-31', 'mensual')).toBe('2026-02-28');
    expect(sumarPeriodo('2028-01-31', 'mensual')).toBe('2028-02-29');
    expect(sumarPeriodo('2026-11-13', 'anual')).toBe('2027-11-13');
    expect(sumarPeriodo('2028-02-29', 'anual')).toBe('2029-02-28');
    expect(sumarPeriodo('2026-12-15', 'mensual', 2)).toBe('2027-02-15');
  });
  it('dinero', () => expect(dinero(2990)).toBe('$2,990.00'));
});

describe('cobro', () => {
  it('monto escrito gana al catálogo', () => {
    expect(calcularCobro(100, 2990, null)).toMatchObject({ total: 100, origen: 'monto' });
    expect(calcularCobro(null, 2990, null)).toMatchObject({ total: 2990, origen: 'catalogo' });
    expect(calcularCobro(null, null, null).total).toBeNull();
  });
  it('cupones', () => {
    expect(calcularCobro(null, 2990, cup('pct', 10)).total).toBe(2691);
    expect(calcularCobro(null, 299, cup('monto', 500)).total).toBe(0);
    const g = calcularCobro(null, 299, cup('periodo_gratis', 2));
    expect(g).toMatchObject({ total: 0, periodos: 2, gratis: true });
  });
  it('vigencia nueva', () => {
    const v = sus('pro', 'activa', '2026-12-01');
    expect(vigenciaNueva(v, 'pro', 'mensual', 1, '2026-11-13')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01', extiende: true });
    expect(vigenciaNueva(v, 'destacado', 'anual', 1, '2026-11-13')).toEqual({ desde: '2026-11-13', hasta: '2027-11-13', extiende: false });
    expect(vigenciaNueva(sus('pro', 'gracia', '2026-11-10'), 'pro', 'mensual', 1, '2026-11-13').hasta).toBe('2026-12-13');
    expect(vigenciaNueva(null, 'pro', 'mensual', 1, '2026-11-13').extiende).toBe(false);
  });
  it('suscripción vigente', () => {
    expect(suscripcionVigente([sus('a', 'vencida', '2026-01-01'), sus('b', 'activa', '2027-01-01'), sus('c', 'cancelada', '2028-01-01')])?.planClave).toBe('b');
    expect(suscripcionVigente([])).toBeNull();
  });
  it('validación y cuerpo', () => {
    const f = formActivarVacio();
    expect(errorDeActivar(f, calcularCobro(null, null, null))['planClave']).toBeTruthy();
    f.planClave = 'pro';
    f.monto = 'abc';
    expect(errorDeActivar(f, calcularCobro(null, 100, null))['monto']).toBeTruthy();
    f.monto = '';
    expect(errorDeActivar(f, calcularCobro(null, 100, null))).toEqual({});
    expect(activarParaApi(f, calcularCobro(null, 100, null))).toMatchObject({ planClave: 'pro', metodo: 'transferencia', monto: null, cupon: null });
    expect(activarParaApi(f, calcularCobro(null, 100, cup('pct', 100))).metodo).toBeNull();
  });
  it('acciones del pago', () => {
    expect(accionesDePago('pendiente').map((a) => a.estado)).toEqual(['pagado', 'fallido']);
    expect(accionesDePago('pagado').map((a) => a.estado)).toEqual(['reembolsado']);
    expect(accionesDePago('reembolsado')).toEqual([]);
  });
});

describe('verificación', () => {
  it('cuerpo y vigencia', () => {
    expect(verificacionParaApi({ metodo: 'llamada', resultado: 'aprobada', notas: ' ', vigenteHasta: '2027-06-30' })).toEqual({ metodo: 'llamada', resultado: 'aprobada', notas: null, vigenteHasta: '2027-06-30T23:59:59-06:00' });
    const l = [{ resultado: 'rechazada', fecha: '2026-05-10T00:00:00Z', vigenteHasta: null }, { resultado: 'aprobada', fecha: '2026-07-02T00:00:00Z', vigenteHasta: '2027-06-30T23:59:59-06:00' }];
    expect(verificacionVigente(l, new Date('2026-11-13'))?.resultado).toBe('aprobada');
    expect(verificacionVigente(l, new Date('2027-07-02'))).toBeNull();
    expect(verificacionVigente([{ resultado: 'rechazada', fecha: '2026-08-01T00:00:00Z', vigenteHasta: null }, ...l], new Date('2026-11-13'))).toBeNull();
  });
});

describe('precios y cupones', () => {
  it('estado de un precio', () => {
    expect(estadoPrecio({ vigenteDesde: '2026-01-01', vigenteHasta: null }, '2026-11-13')).toBe('vigente');
    expect(estadoPrecio({ vigenteDesde: '2026-12-01', vigenteHasta: null }, '2026-11-13')).toBe('futuro');
    expect(estadoPrecio({ vigenteDesde: '2025-01-01', vigenteHasta: '2025-12-31' }, '2026-11-13')).toBe('cerrado');
  });
  it('alcance', () => {
    const arbol = [{ id: 'c1', padreId: null, clave: 'h', nombre: 'Dónde dormir', hijas: [{ id: 'c2', padreId: 'c1', clave: 'hotel', nombre: 'Hotel', hijas: [] }] }];
    expect(alcancePrecio({ destinoId: null, categoriaId: null }, [], arbol)).toBe('General');
    expect(alcancePrecio({ destinoId: 'd1', categoriaId: 'c2' }, [{ id: 'd1', codigo: 'oax', nombre: 'Oaxaca' }], arbol)).toBe('Oaxaca · Hotel');
    expect(categoriasConRuta(arbol).map((c) => c.etiqueta)).toEqual(['Dónde dormir', 'Dónde dormir › Hotel']);
  });
  it('validación de precio, plan y cupón', () => {
    const p = formPrecioVacio();
    expect(Object.keys(errorDePrecio(p)).sort()).toEqual(['monto', 'planId']);
    p.planId = 'x'; p.monto = '299';
    expect(errorDePrecio(p)).toEqual({});
    p.vigenteDesde = '2026-12-01'; p.vigenteHasta = '2026-11-01';
    expect(errorDePrecio(p)['vigenteHasta']).toBeTruthy();
    expect(errorDePlan({ nombre: '', limiteFotos: '0', limiteOfertas: '-1', veEstadisticas: false, permitePromociones: false, permitePatrocinio: false, activo: true })).toHaveProperty('limiteFotos');
    const c = formCuponVacio();
    c.codigo = 'AB'; c.valor = '150';
    expect(Object.keys(errorDeCupon(c)).sort()).toEqual(['codigo', 'valor']);
    c.codigo = 'BIENVENIDA10'; c.valor = '10'; c.maxUsos = '3';
    expect(errorDeCupon(c, 4)['maxUsos']).toContain('4 veces');
    expect(errorDeCupon(c, 0)).toEqual({});
  });
  it('texto y vigencia de cupón', () => {
    expect(valorCuponTexto(cup('pct', 10))).toBe('10 %');
    expect(valorCuponTexto(cup('periodo_gratis', 1))).toBe('1 periodo');
    expect(cuponVigente({ vigenteDesde: null, vigenteHasta: '2026-12-31', maxUsos: 50, usos: 4 }, '2026-11-13')).toBe(true);
    expect(cuponVigente({ vigenteDesde: null, vigenteHasta: '2026-12-31', maxUsos: 4, usos: 4 }, '2026-11-13')).toBe(false);
  });
});
