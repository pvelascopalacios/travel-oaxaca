import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { FILTROS_VACIOS, aQuery, alternar, contarFiltros, finDeSemanaMx, hoyMx, idsDeRaices, leerFiltros, paramsNegocios, serviciosDelGrupo, sinFiltros } from './filtros';
import { Categoria, Servicio } from './modelos';

const arbol: Categoria[] = [
  { id: 'h', padreId: null, clave: 'hospedaje', nombre: 'Hospedaje', hijas: [
    { id: 'h1', padreId: 'h', clave: 'hotel', nombre: 'Hotel', hijas: [] },
    { id: 'h2', padreId: 'h', clave: 'posada', nombre: 'Posada', hijas: [] },
  ] },
  { id: 'c', padreId: null, clave: 'comida', nombre: 'Comida', hijas: [] },
];
const servicios: Servicio[] = [
  { id: 's1', clave: 'wifi', grupo: 'hospedaje', nombre: 'Wi-Fi' },
  { id: 's2', clave: 'desayuno', grupo: 'hospedaje', nombre: 'Desayuno' },
];

describe('filtros en la dirección', () => {
  it('lee y vuelve a escribir sin perder nada', () => {
    const p = convertToParamMap({ tipo: 'hotel,posada', servicios: 'wifi', precio: '2', abierto: '1', idiomas: 'en,zap', orden: 'precio', vista: 'mapa' });
    const f = leerFiltros(p);
    expect(f.tipos).toEqual(['hotel', 'posada']);
    expect(f.precio).toBe(2);
    expect(f.abierto).toBe(true);
    expect(f.mapa).toBe(true);
    const q = aQuery(f);
    expect(q['tipo']).toBe('hotel,posada');
    expect(q['vista']).toBe('mapa');
    expect(leerFiltros(convertToParamMap(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)]))))).toEqual(f);
  });

  it('ignora valores raros en lugar de romper', () => {
    const f = leerFiltros(convertToParamMap({ precio: '99', orden: 'hackeo', idiomas: 'xx,en', desde: 'mañana', ver: 'otra' }));
    expect(f.precio).toBeNull();
    expect(f.orden).toBe('relevancia');
    expect(f.idiomas).toEqual(['en']);
    expect(f.desde).toBeNull();
    expect(f.ver).toBe('lugares');
  });

  it('la dirección sin filtros queda limpia', () => {
    expect(aQuery(FILTROS_VACIOS)).toEqual({});
  });

  it('cuenta lo que muestra el botón Filtros y borra solo eso', () => {
    const f = { ...FILTROS_VACIOS, tipos: ['hotel'], servicios: ['wifi', 'desayuno'], precio: 2, mapa: true, orden: 'precio' as const };
    expect(contarFiltros(f)).toBe(4);
    const limpio = sinFiltros(f);
    expect(contarFiltros(limpio)).toBe(0);
    expect(limpio.mapa).toBe(true);
  });

  it('alternar agrega y quita', () => {
    expect(alternar(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternar(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('consulta a la API', () => {
  it('sin elegir tipo manda todas las subcategorías del grupo', () => {
    const ids = idsDeRaices(arbol, ['hospedaje']);
    expect(ids.map((x) => x.id)).toEqual(['h1', 'h2']);
    const p = paramsNegocios(FILTROS_VACIOS, { ids, servicios, pagina: 1, tamano: 12 });
    expect(p['categoriaIds']).toEqual(['h1', 'h2']);
    expect(p['abiertoAhora']).toBeUndefined();
  });

  it('una raíz sin hijas cuenta como categoría', () => {
    expect(idsDeRaices(arbol, ['comida'])).toEqual([{ id: 'c', clave: 'comida' }]);
  });

  it('traduce claves de servicio a ids y respeta el tipo elegido', () => {
    const ids = idsDeRaices(arbol, ['hospedaje']);
    const f = { ...FILTROS_VACIOS, tipos: ['posada'], servicios: ['wifi', 'inexistente'], precio: 2, abierto: true };
    const p = paramsNegocios(f, { ids, servicios, pagina: 2, tamano: 12 });
    expect(p['categoriaIds']).toEqual(['h2']);
    expect(p['servicioIds']).toEqual(['s1']);
    expect(p['precioMax']).toBe(2);
    expect(p['abiertoAhora']).toBe(true);
    expect(p['pagina']).toBe(2);
  });

  it('ordenar por distancia solo se manda con ubicación', () => {
    const ids = idsDeRaices(arbol, ['hospedaje']);
    const f = { ...FILTROS_VACIOS, orden: 'distancia' as const, cerca: true };
    expect(paramsNegocios(f, { ids, servicios, pagina: 1, tamano: 12 })['orden']).toBeUndefined();
    const con = paramsNegocios(f, { ids, servicios, pagina: 1, tamano: 12, lat: 17, lng: -96 });
    expect(con['orden']).toBe('distancia');
    expect(con['cerca']).toBe(true);
  });

  it('solo ofrece los servicios que existen en el catálogo', () => {
    expect(serviciosDelGrupo('dormir', servicios).map((s) => s.clave)).toEqual(['wifi', 'desayuno']);
  });
});

describe('fechas en hora de México', () => {
  it('hoy usa la fecha de México aunque en UTC ya sea mañana', () => {
    expect(hoyMx(new Date('2026-11-13T03:30:00Z'))).toBe('2026-11-12');
  });
  it('fin de semana desde un jueves', () => {
    expect(finDeSemanaMx(new Date('2026-11-12T18:00:00Z'))).toEqual({ desde: '2026-11-14', hasta: '2026-11-15' });
  });
  it('en sábado empieza hoy y en domingo es solo hoy', () => {
    expect(finDeSemanaMx(new Date('2026-11-14T18:00:00Z'))).toEqual({ desde: '2026-11-14', hasta: '2026-11-15' });
    expect(finDeSemanaMx(new Date('2026-11-15T18:00:00Z'))).toEqual({ desde: '2026-11-15', hasta: '2026-11-15' });
  });
});

describe('municipio en la dirección', () => {
  const ID = '11111111-aaaa-4aaa-8aaa-000000000001';
  it('se lee y se escribe con su nombre', () => {
    const f = leerFiltros(convertToParamMap({ municipio: ID, en: 'Huajuapan de León' }));
    expect(f.municipio).toBe(ID);
    expect(f.en).toBe('Huajuapan de León');
    expect(aQuery(f)).toMatchObject({ municipio: ID, en: 'Huajuapan de León' });
  });
  it('un id que no es UUID se ignora, y el nombre con él', () => {
    const f = leerFiltros(convertToParamMap({ municipio: 'huajuapan', en: 'x' }));
    expect(f.municipio).toBeNull();
    expect(f.en).toBe('');
  });
  it('viaja a la API como municipioId y sobrevive a «borrar todo»', () => {
    const f = { ...FILTROS_VACIOS, municipio: ID, en: 'H', tipos: ['hotel'] };
    expect(paramsNegocios(f, { ids: [], servicios: [], pagina: 1, tamano: 12 })['municipioId']).toBe(ID);
    expect(sinFiltros(f).municipio).toBe(ID);
    expect(sinFiltros(f).tipos).toEqual([]);
  });
});
