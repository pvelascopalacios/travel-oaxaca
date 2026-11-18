import { describe, expect, it } from 'vitest';
import {
  bloqueParaApi, categoriasEnFilas, errorDeBloque, errorDeEvento, errorDeGeo, errorDeLugar, errorDeNombres, errorDeParada, errorDeRuta, errorDeUbicacion, estadoContenido, eventoParaApi,
  faltasParaPublicar, formBloqueVacio, formDeBloque, formDeEvento, formDeLugar, formDeRuta, formEventoVacio, formLugarVacio, formRutaVacio, lugarParaApi, moverElemento, nombresParaApi, rutaParaApi,
} from './contenido';
import { BloqueAdmin, EventoAdmin, LugarAdmin, RutaAdmin } from './modelos';

describe('estados y ubicación', () => {
  it('estadoContenido distingue género', () => {
    expect(estadoContenido('publicada').texto).toBe('Publicada');
    expect(estadoContenido('publicado').texto).toBe('Publicado');
    expect(estadoContenido('cancelado').clase).toBe('mal');
  });
  it('ubicación va completa y dentro de Oaxaca', () => {
    expect(errorDeUbicacion(null, null)).toBeNull();
    expect(errorDeUbicacion(17.06, null)).toContain('completo');
    expect(errorDeUbicacion(-96.7, 17.06)).toContain('no están en Oaxaca');
    expect(errorDeUbicacion(17.06, -96.72)).toBeNull();
  });
  it('moverElemento', () => {
    expect(moverElemento([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    const l = [1, 2];
    expect(moverElemento(l, 0, -1)).toBe(l);
    expect(moverElemento(l, 1, 2)).toBe(l);
  });
});

describe('bloques de inicio', () => {
  const base = () => {
    const f = formBloqueVacio('destacado');
    f.textos['es'].titulo = 'Guelaguetza';
    return f;
  };
  it('un borrador solo pide el título', () => {
    expect(errorDeBloque(base())).toEqual({});
    const f = base();
    f.textos['es'].titulo = ' ';
    expect(errorDeBloque(f)['titulo']).toBeTruthy();
  });
  it('publicar exige foto, ruta y botón en un destacado', () => {
    const f = base();
    f.estado = 'publicado';
    const e = errorDeBloque(f);
    expect(Object.keys(e).sort()).toEqual(['boton', 'medioId', 'ruta']);
    f.medioId = 'm1'; f.ruta = '/evento/guelaguetza'; f.textos['es'].boton = 'Ver';
    expect(errorDeBloque(f)).toEqual({});
  });
  it('la ruta es del sitio y el Reel es de Facebook', () => {
    const f = base();
    f.ruta = 'https://otro.com';
    expect(errorDeBloque(f)['ruta']).toBeTruthy();
    f.ruta = '//otro.com';
    expect(errorDeBloque(f)['ruta']).toBeTruthy();
    const r = formBloqueVacio('reel');
    r.textos['es'].titulo = 'Reel';
    r.enlace = 'https://youtube.com/x';
    expect(errorDeBloque(r)['enlace']).toBeTruthy();
    r.enlace = 'https://fb.watch/abc';
    expect(errorDeBloque(r)['enlace']).toBeUndefined();
  });
  it('historia pide persona y permiso; pueblo con saludo pide lengua y quién verificó', () => {
    const h = formBloqueVacio('historia');
    h.textos['es'].titulo = 'Frase'; h.estado = 'publicado'; h.medioId = 'm';
    expect(faltasParaPublicar(h).filter((x) => !x.ok).map((x) => x.campo)).toEqual(['persona', 'permisoConfirmado']);
    const p = formBloqueVacio('pueblo');
    p.textos['es'].titulo = 'Pueblo'; p.saludo = 'Guendarananda';
    expect(Object.keys(errorDeBloque(p)).sort()).toEqual(['saludoIdioma', 'saludoVerificadoPor']);
  });
  it('fechas, orden y otros idiomas', () => {
    const f = base();
    f.publicarDesde = '2027-02-01'; f.publicarHasta = '2027-01-01'; f.orden = '1000';
    f.textos['en'] = { etiqueta: 'x', titulo: '', texto: '', boton: '' };
    const e = errorDeBloque(f);
    expect(e['publicarHasta']).toBeTruthy(); expect(e['orden']).toBeTruthy(); expect(e['titulo-en']).toBeTruthy();
  });
  it('bloqueParaApi descarta lo que no es del tipo y los idiomas vacíos', () => {
    const f = base();
    f.ruta = '/x'; f.enlace = 'https://fb.watch/a'; f.persona = 'Ana'; f.permisoConfirmado = true;
    f.textos['en'] = { etiqueta: '', titulo: '', texto: '', boton: '' };
    const b = bloqueParaApi(f);
    expect(b.ruta).toBe('/x'); expect(b.enlace).toBeNull(); expect(b.persona).toBeNull(); expect(b.permisoConfirmado).toBe(false);
    expect(Object.keys(b.traducciones)).toEqual(['es']);
  });
  it('formDeBloque rellena y asegura español', () => {
    const f = formDeBloque({ id: '1', tipo: 'reel', orden: 2, estado: 'borrador', publicarDesde: null, publicarHasta: null, medioId: null, fotoUrl: null, credito: null, ruta: null, enlace: 'https://fb.watch/a', comunidades: null, saludo: null, saludoIdioma: null, saludoVerificadoPor: null, persona: null, lugar: null, negocioId: null, permisoConfirmado: false, traducciones: {}, actualizadoEn: '' } as BloqueAdmin);
    expect(f.orden).toBe('2'); expect(f.textos['es']).toBeTruthy(); expect(f.enlace).toContain('fb.watch');
  });
});

describe('lugares', () => {
  it('lo mínimo es el nombre; publicar pide municipio y mapa', () => {
    const f = formLugarVacio();
    expect(errorDeLugar(f)['nombre']).toBeTruthy();
    f.textos['es'].nombre = 'Monte Albán';
    expect(errorDeLugar(f)).toEqual({});
    f.estado = 'publicado';
    expect(errorDeLugar(f)['estado']).toBeTruthy();
    f.municipioId = 'm'; f.latitud = 17.04; f.longitud = -96.76;
    expect(errorDeLugar(f)).toEqual({});
  });
  it('entrada gratis no manda costos; con costo valida el rango', () => {
    const f = formLugarVacio();
    f.textos['es'].nombre = 'X'; f.entrada = 'gratis'; f.costoNacional = '50';
    expect(lugarParaApi(f).datos).toEqual({ entrada: 'gratis' });
    f.entrada = 'con_costo'; f.costoNacional = '200000';
    expect(errorDeLugar(f)['costoNacional']).toBeTruthy();
    f.costoNacional = '80.5';
    expect(lugarParaApi(f).datos.costoNacional).toBe(80.5);
  });
  it('días, accesible y otros idiomas', () => {
    const f = formLugarVacio();
    f.textos['es'].nombre = 'X'; f.dias = [3, 1, 1]; f.accesible = 'no'; f.textos['en'] = { nombre: '', resumen: '', historia: '', recomendaciones: '', mejorEpoca: '', comoLlegar: '' };
    const l = lugarParaApi(f);
    expect(l.datos.diasAbierto).toEqual([1, 3]); expect(l.datos.accesible).toBe(false); expect(Object.keys(l.traducciones)).toEqual(['es']);
  });
  it('formDeLugar recupera los datos', () => {
    const f = formDeLugar({ id: '1', slug: 's', tipo: 'natural', municipioId: 'm', padreId: null, latitud: 17, longitud: -96, destacado: true, estado: 'publicado', datos: { entrada: 'con_costo', costoNacional: 90, diasAbierto: [2, 1], accesible: true }, traducciones: { es: { nombre: 'A', resumen: null, historia: null, recomendaciones: null, mejorEpoca: null, comoLlegar: null } }, medioIds: [], actualizadoEn: '' } as LugarAdmin);
    expect(f.costoNacional).toBe('90'); expect(f.dias).toEqual([1, 2]); expect(f.accesible).toBe('si'); expect(f.textos['es'].nombre).toBe('A');
  });
});

describe('rutas', () => {
  it('valida duración, paradas y publicar', () => {
    const f = formRutaVacio();
    f.textos['es'].nombre = 'Ruta';
    expect(errorDeRuta(f)['duracionHoras']).toBeTruthy();
    f.duracionHoras = '3'; f.estado = 'publicada';
    expect(errorDeRuta(f)['paradas']).toBeTruthy();
    f.paradas = [{ tipo: 'lugar', lugarId: 'a', negocioId: null, nombre: '', latitud: '', longitud: '', minutos: '' }, { tipo: 'punto', lugarId: null, negocioId: null, nombre: '', latitud: '17.06', longitud: '-96.72', minutos: '15' }];
    expect(errorDeRuta(f)).toEqual({});
  });
  it('cada parada es una sola cosa', () => {
    expect(errorDeParada({ tipo: 'lugar', lugarId: null, negocioId: null, nombre: '', latitud: '', longitud: '', minutos: '' })).toBeTruthy();
    expect(errorDeParada({ tipo: 'punto', lugarId: null, negocioId: null, nombre: '', latitud: '17', longitud: '', minutos: '' })).toBeTruthy();
    expect(errorDeParada({ tipo: 'punto', lugarId: null, negocioId: null, nombre: '', latitud: '40', longitud: '-96', minutos: '' })).toContain('Oaxaca');
    expect(errorDeParada({ tipo: 'negocio', lugarId: null, negocioId: 'n', nombre: '', latitud: '', longitud: '', minutos: '-3' })).toBeTruthy();
  });
  it('rutaParaApi manda solo una referencia por parada', () => {
    const f = formRutaVacio();
    f.textos['es'].nombre = 'R'; f.duracionHoras = '2.5';
    f.paradas = [{ tipo: 'lugar', lugarId: 'a', negocioId: 'zzz', nombre: '', latitud: '17', longitud: '-96', minutos: '10' }];
    const r = rutaParaApi(f);
    expect(r.paradas[0]).toEqual({ lugarId: 'a', negocioId: null, latitud: null, longitud: null, minutosEstimados: 10 });
    expect(r.duracionHoras).toBe(2.5); expect(r.distanciaKm).toBeNull();
  });
  it('formDeRuta deduce el tipo de parada', () => {
    const f = formDeRuta({ id: '1', slug: 's', duracionHoras: 3, distanciaKm: null, dificultad: 'facil', transporte: 'a_pie', esPremium: false, estado: 'borrador', traducciones: {}, paradas: [{ lugarId: null, negocioId: 'n', latitud: null, longitud: null, minutosEstimados: null }, { lugarId: null, negocioId: null, latitud: 17, longitud: -96, minutosEstimados: 5 }], actualizadoEn: '' } as RutaAdmin);
    expect(f.paradas.map((p) => p.tipo)).toEqual(['negocio', 'punto']);
  });
});

describe('eventos', () => {
  it('fechas y horas', () => {
    const f = formEventoVacio();
    f.textos['es'].nombre = 'Guelaguetza';
    expect(Object.keys(errorDeEvento(f)).sort()).toEqual(['fechaFin', 'fechaInicio']);
    f.fechaInicio = '2027-07-19'; f.fechaFin = '2027-07-18'; f.horaInicio = '25:00';
    const e = errorDeEvento(f);
    expect(e['fechaFin']).toBeTruthy(); expect(e['horaInicio']).toBeTruthy();
    f.fechaFin = '2027-07-26'; f.horaInicio = '10:00';
    expect(errorDeEvento(f)).toEqual({});
  });
  it('gratis no manda costo y se quitan negocios repetidos', () => {
    const f = formEventoVacio();
    f.textos['es'].nombre = 'E'; f.fechaInicio = f.fechaFin = '2027-01-01'; f.gratis = true; f.costoTexto = '$100';
    f.negocios = [{ id: 'a', nombre: '' }, { id: 'a', nombre: '' }, { id: 'b', nombre: '' }];
    const ev = eventoParaApi(f);
    expect(ev.datos).toEqual({ gratis: true }); expect(ev.negocioIds).toEqual(['a', 'b']);
  });
  it('conserva la temporada al editar', () => {
    const f = formDeEvento({ id: '1', slug: 's', fechaInicio: '2027-01-01', fechaFin: '2027-01-02', municipioId: null, temporadaId: 't1', latitud: null, longitud: null, estado: 'borrador', datos: {}, traducciones: {}, negocioIds: ['n1'], actualizadoEn: '' } as EventoAdmin);
    expect(eventoParaApi({ ...f, textos: { es: { nombre: 'x', descripcion: '' } } }).temporadaId).toBe('t1');
    expect(f.negocios).toEqual([{ id: 'n1', nombre: '' }]);
  });
});

describe('catálogos', () => {
  it('nombres: español obligatorio, clave en minúsculas solo al crear', () => {
    const f = { clave: 'Cabañas', icono: '', orden: '', activo: true, padreId: '', grupo: 'general', nombres: { es: '' } };
    expect(Object.keys(errorDeNombres(f, true, false)).sort()).toEqual(['clave', 'nombre-es']);
    expect(Object.keys(errorDeNombres(f, false, false))).toEqual(['nombre-es']);
    f.clave = 'cabanas'; f.nombres.es = 'Cabañas';
    expect(errorDeNombres(f, true, true)).toEqual({});
    expect(nombresParaApi({ es: ' Cabañas ', en: ' ' })).toEqual({ es: 'Cabañas' });
  });
  it('municipio: INEGI de 5 dígitos y coordenadas', () => {
    const g = { nombre: 'X', claveInegi: '2006', latitud: '17', longitud: '', activo: true, regionId: '' };
    expect(Object.keys(errorDeGeo(g, true)).sort()).toEqual(['claveInegi', 'latitud', 'regionId']);
    expect(errorDeGeo({ ...g, claveInegi: '20067', latitud: '17.06', longitud: '-96.72', regionId: 'r' }, true)).toEqual({});
    expect(errorDeGeo({ nombre: 'Loc', claveInegi: '', latitud: '', longitud: '', activo: true, regionId: '' }, false)).toEqual({});
  });
  it('categoriasEnFilas aplana con nivel', () => {
    const f = categoriasEnFilas([{ id: 'a', padreId: null, clave: 'a', nombre: 'A', icono: null, orden: 1, hijas: [{ id: 'b', padreId: 'a', clave: 'b', nombre: 'B', icono: null, orden: 1, hijas: [] }] }]);
    expect(f.map((x) => x.nivel)).toEqual([0, 1]);
  });
});
