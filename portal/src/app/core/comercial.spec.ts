import { describe, expect, it } from 'vitest';
import {
  contactoEnlace, diasTexto, errorDeCorreo, errorDePromo, formVacioPromo, hoyIso, inicialesDe, insignia,
  miembrosVisibles, ordenarPromos, precioGeneral, promoParaApi, puedeEnviarPromo, sumarDias, usoPorcentaje, valorPromo,
} from './comercial';
import { Miembro, PlanPublico, Promocion } from './modelos';

const HOY = '2026-11-13';
const form = () => {
  const f = formVacioPromo(HOY);
  f.titulo['es'] = 'Mezcal de cortesía';
  return f;
};

describe('promociones', () => {
  it('fechas', () => {
    expect(hoyIso(new Date(2026, 10, 3))).toBe('2026-11-03');
    expect(sumarDias('2026-12-20', 15)).toBe('2027-01-04');
  });
  it('valida el porcentaje', () => {
    const f = form();
    expect(errorDePromo(f, HOY)['valor']).toBeTruthy();
    f.valor = '150';
    expect(errorDePromo(f, HOY)['valor']).toBeTruthy();
    f.valor = '15';
    expect(errorDePromo(f, HOY)).toEqual({});
  });
  it('dos por uno no manda valor', () => {
    const f = form();
    f.tipo = 'dos_por_uno';
    f.valor = '20';
    expect(errorDePromo(f, HOY)).toEqual({});
    expect(promoParaApi(f).valor).toBeNull();
  });
  it('valida fechas y código', () => {
    const f = form();
    f.valor = '10';
    f.fin = '2026-11-01';
    expect(errorDePromo(f, HOY)['fin']).toBeTruthy();
    f.inicio = '2026-11-20';
    f.fin = '2026-11-15';
    expect(errorDePromo(f, HOY)['fin']).toContain('posterior');
    f.inicio = HOY;
    f.fin = sumarDias(HOY, 400);
    expect(errorDePromo(f, HOY)['fin']).toContain('un año');
    f.fin = sumarDias(HOY, 10);
    f.codigo = 'a b';
    expect(errorDePromo(f, HOY)['codigo']).toBeTruthy();
  });
  it('exige título en español y arma los textos', () => {
    const f = form();
    f.valor = '10';
    f.titulo['es'] = ' ';
    expect(errorDePromo(f, HOY)['titulo.es']).toBeTruthy();
    f.titulo['es'] = 'Hola';
    f.titulo['en'] = 'Hi';
    f.descripcion['en'] = ' ';
    f.codigo = ' ';
    const e = promoParaApi(f);
    expect(e.textos).toEqual([{ idioma: 'es', titulo: 'Hola', descripcion: null }, { idioma: 'en', titulo: 'Hi', descripcion: null }]);
    expect(e.codigo).toBeNull();
  });
  it('textos de valor', () => {
    expect(valorPromo({ tipo: 'descuento_pct', valor: 15 }).grande).toBe('15 %');
    expect(insignia({ tipo: 'descuento_monto', valor: 500 })).toBe('$500 de descuento');
    expect(insignia({ tipo: 'regalo', valor: null })).toBe('Regalo');
  });
  it('ordena y decide si se envía', () => {
    const p = (estado: string, inicio: string, fin = '2027-01-01'): Promocion =>
      ({ id: estado + inicio, ofertaId: null, tipo: 'regalo', valor: null, codigo: null, inicio, fin, condiciones: null, estado, motivoRechazo: null, textos: [] });
    const l = ordenarPromos([p('vencida', '2026-01-01'), p('borrador', '2026-12-01'), p('activa', '2026-11-01')]);
    expect(l.map((x) => x.estado)).toEqual(['activa', 'borrador', 'vencida']);
    expect(puedeEnviarPromo(p('borrador', HOY), HOY)).toBe(true);
    expect(puedeEnviarPromo(p('borrador', HOY, '2026-11-01'), HOY)).toBe(false);
    expect(puedeEnviarPromo(p('activa', HOY), HOY)).toBe(false);
  });
});

describe('plan', () => {
  const plan = (precios: PlanPublico['precios']): PlanPublico =>
    ({ clave: 'pro', nombre: 'Pro', limiteFotos: 15, limiteOfertas: 10, veEstadisticas: true, permitePromociones: true, permitePatrocinio: false, precios });
  it('toma el precio general vigente', () => {
    const base = { planClave: 'pro', moneda: 'MXN', vigenteDesde: null, vigenteHasta: null };
    const p = plan([
      { ...base, periodo: 'mensual', monto: 199, destinoId: 'x', categoriaId: null },
      { ...base, periodo: 'mensual', monto: 299, destinoId: null, categoriaId: null },
      { ...base, periodo: 'anual', monto: 2990, destinoId: null, categoriaId: null, vigenteHasta: '2026-01-01' },
    ]);
    expect(precioGeneral(p, 'mensual', HOY)?.monto).toBe(299);
    expect(precioGeneral(p, 'anual', HOY)).toBeNull();
  });
  it('uso y días', () => {
    expect(usoPorcentaje(5, 10)).toBe(50);
    expect(usoPorcentaje(12, 10)).toBe(100);
    expect(usoPorcentaje(1, 0)).toBe(0);
    expect(diasTexto(1)).toBe('te queda 1 día');
    expect(diasTexto(0)).toBe('vence hoy');
  });
  it('contacto', () => {
    expect(contactoEnlace('')).toBeNull();
    expect(contactoEnlace('https://wa.me/5219511234567')?.href).toBe('https://wa.me/5219511234567');
    expect(contactoEnlace('951 123 4567')?.href).toBe('https://wa.me/529511234567');
    expect(contactoEnlace('Pregunta en recepción')?.href).toBeNull();
  });
});

describe('equipo', () => {
  const m = (usuarioId: string, rol: string, estado: string, creadoEn = '2026-01-01'): Miembro =>
    ({ usuarioId, correo: usuarioId + '@x.mx', nombre: null, rol, estado, creadoEn });
  it('ordena y oculta revocadas', () => {
    const l = miembrosVisibles([m('c', 'colaborador', 'invitada'), m('b', 'colaborador', 'revocada'), m('a', 'colaborador', 'activa'), m('p', 'propietario', 'activa')]);
    expect(l.map((x) => x.usuarioId)).toEqual(['p', 'a', 'c']);
  });
  it('iniciales y correo', () => {
    expect(inicialesDe({ nombre: 'María López', correo: 'm@x.mx' })).toBe('ML');
    expect(inicialesDe({ nombre: null, correo: 'luis@x.mx' })).toBe('L');
    expect(errorDeCorreo('')).toBeTruthy();
    expect(errorDeCorreo('a@b')).toBeTruthy();
    expect(errorDeCorreo('a@b.mx')).toBeNull();
  });
});
