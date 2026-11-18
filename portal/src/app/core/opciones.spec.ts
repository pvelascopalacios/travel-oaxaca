import { describe, expect, it } from 'vitest';
import { cupoFotos, enOrden, errorDeArchivo, hayCambiosDeOrden, mover, moderacionInfo, MAX_BYTES, pesoTexto } from './fotos';
import { MedioFicha, Oferta, PlanNegocio } from './modelos';
import {
  accionDeEstado, agrupar, cupoOfertas, duracionAMinutos, duracionTexto, errorDeOferta, formDeOferta, formVacio, moverOferta,
  ofertaParaApi, precioTexto, tiposDeRaiz, tituloLista,
} from './opciones';

const medio = (id: string, orden: number, portada = false): MedioFicha => ({ medioId: id, url: '', orden, esPortada: portada, pieTexto: null, moderacion: 'aprobado', motivoRechazo: null });
const plan = (fotos: number, ofertas: number): PlanNegocio => ({
  plan: { clave: 'x', nombre: 'X', limiteFotos: fotos, limiteOfertas: ofertas, veEstadisticas: false, permitePromociones: false },
  uso: { fotos: 0, limiteFotos: fotos, ofertas: 0, limiteOfertas: ofertas },
  suscripcion: null, enGracia: false, diasRestantes: null, gratuito: false,
});
const oferta = (id: string, nombre: string, orden: number, extra: Partial<Oferta> = {}): Oferta => ({
  id, tipo: 'platillo', estado: 'publicada', precioDesde: 100, unidadPrecio: 'por_persona', duracionMin: null, capacidad: null, orden, seccion: 'platos_fuertes', etiquetas: [],
  traducciones: { es: { nombre, descripcion: null, incluye: null, noIncluye: null } }, ...extra,
});

describe('fotos', () => {
  it('valida tipo, peso y vacío con los mensajes de la API', () => {
    expect(errorDeArchivo({ type: 'image/png', size: 1000 })).toBeNull();
    expect(errorDeArchivo({ type: 'image/gif', size: 1000 })).toContain('JPEG, PNG o WebP');
    expect(errorDeArchivo({ type: 'image/jpeg', size: 0 })).toBe('El archivo está vacío.');
    expect(errorDeArchivo({ type: 'image/jpeg', size: MAX_BYTES + 1 })).toBe('La foto pesa demasiado. El máximo es 10 MB.');
    expect(errorDeArchivo({ type: 'image/jpeg', size: MAX_BYTES })).toBeNull();
  });

  it('peso legible', () => {
    expect(pesoTexto(2_516_582)).toBe('2.4 MB');
    expect(pesoTexto(10 * 1024 * 1024)).toBe('10 MB');
    expect(pesoTexto(500)).toBe('1 KB');
  });

  it('cupo: el menor entre el plan y 20', () => {
    expect(cupoFotos(3, plan(3, 0))).toEqual({ maximo: 3, restante: 0, lleno: true });
    expect(cupoFotos(6, plan(15, 10))).toEqual({ maximo: 15, restante: 9, lleno: false });
    expect(cupoFotos(6, plan(30, 30))).toEqual({ maximo: 20, restante: 14, lleno: false });
    expect(cupoFotos(6, null).maximo).toBe(20);
  });

  it('moderación', () => {
    expect(moderacionInfo('pendiente').texto).toBe('En revisión');
    expect(moderacionInfo('rechazado').clase).toBe('no');
    expect(moderacionInfo('raro').texto).toBe('raro');
  });

  it('mover y detectar cambios de orden o portada', () => {
    expect(mover(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(mover(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(mover(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    const g = [medio('b', 1), medio('a', 0, true)];
    expect(enOrden(g).map((m) => m.medioId)).toEqual(['a', 'b']);
    expect(hayCambiosDeOrden(['a', 'b'], 'a', g)).toBe(false);
    expect(hayCambiosDeOrden(['b', 'a'], 'a', g)).toBe(true);
    expect(hayCambiosDeOrden(['a', 'b'], 'b', g)).toBe(true);
  });
});

describe('opciones', () => {
  it('tipos y título por categoría', () => {
    expect(tiposDeRaiz('comida')).toEqual(['platillo']);
    expect(tiposDeRaiz('tours')).toEqual(['tour', 'experiencia']);
    expect(tiposDeRaiz(null)).toEqual([]);
    expect(tituloLista('hospedaje')).toBe('Habitaciones');
    expect(tituloLista('comida')).toBe('Menú');
  });

  it('duración: horas y minutos ↔ minutos', () => {
    expect(duracionAMinutos('4', '30')).toBe(270);
    expect(duracionAMinutos('', '45')).toBe(45);
    expect(duracionAMinutos('', '')).toBeNull();
    expect(duracionTexto(270)).toBe('4 h 30 min');
    expect(duracionTexto(120)).toBe('2 h');
    expect(duracionTexto(45)).toBe('45 min');
    expect(duracionTexto(null)).toBe('');
  });

  it('valida lo mismo que la API y con las mismas claves', () => {
    const f = formVacio('tour');
    expect(errorDeOferta(f)['traducciones.es.nombre']).toBeTruthy();
    f.textos['es'].nombre = 'Cascadas';
    expect(errorDeOferta(f)).toEqual({});
    f.precio = '-5';
    f.capacidad = '0';
    f.horas = '2';
    f.minutos = '75';
    const e = errorDeOferta(f);
    expect(e['precioDesde']).toBeTruthy();
    expect(e['capacidad']).toBeTruthy();
    expect(e['duracionMin']).toBeTruthy();
    f.textos['en'].descripcion = 'Hike';
    expect(errorDeOferta(f)['traducciones.en.nombre']).toBeTruthy();
  });

  it('arma el cuerpo solo con lo que corresponde al tipo', () => {
    const p = formVacio('platillo', 2);
    p.textos['es'].nombre = ' Tlayuda ';
    p.textos['es'].incluye = 'no debe viajar';
    p.precio = '160,50';
    p.etiquetas = ['picante'];
    const a = ofertaParaApi(p);
    expect(a.traducciones['es']).toEqual({ nombre: 'Tlayuda', descripcion: null, incluye: null, noIncluye: null });
    expect(a.traducciones['en']).toBeUndefined();
    expect(a).toMatchObject({ tipo: 'platillo', precioDesde: 160.5, seccion: 'platos_fuertes', etiquetas: ['picante'], duracionMin: null, capacidad: null, orden: 2 });

    const t = formVacio('tour');
    t.textos['es'].nombre = 'Recorrido';
    t.textos['es'].incluye = 'Guía';
    t.horas = '4';
    t.minutos = '30';
    t.capacidad = '8';
    t.etiquetas = ['picante'];
    t.seccion = 'bebidas';
    const b = ofertaParaApi(t);
    expect(b).toMatchObject({ duracionMin: 270, capacidad: 8, seccion: null, etiquetas: [], unidadPrecio: 'por_persona' });
    expect(b.traducciones['es'].incluye).toBe('Guía');
  });

  it('del formulario a la oferta y de vuelta', () => {
    const o = oferta('1', 'Tour', 0, { tipo: 'tour', duracionMin: 90, capacidad: 6, seccion: null });
    const f = formDeOferta(o);
    expect([f.horas, f.minutos, f.capacidad, f.textos['es'].nombre]).toEqual(['1', '30', '6', 'Tour']);
  });

  it('agrupa el menú por sección y separa archivadas', () => {
    const lista = [oferta('1', 'Mole', 1), oferta('2', 'Tlayuda', 0), oferta('3', 'Nicuatole', 0, { seccion: 'postres' }), oferta('4', 'Viejo', 0, { estado: 'archivada' }), oferta('5', 'Sin sección', 0, { seccion: null })];
    const g = agrupar(lista, 'comida');
    expect(g.grupos.map((x) => x.clave)).toEqual(['platos_fuertes', 'postres', 'otros']);
    expect(g.grupos[0].ofertas.map((o) => o.id)).toEqual(['2', '1']);
    expect(g.archivadas.map((o) => o.id)).toEqual(['4']);
    expect(agrupar([oferta('1', 'Hab', 0, { tipo: 'habitacion', seccion: null })], 'hospedaje').grupos[0].clave).toBe('todas');
  });

  it('mover una opción renumera solo lo que cambia', () => {
    const grupo = [oferta('a', 'A', 0), oferta('b', 'B', 1), oferta('c', 'C', 2)];
    expect(moverOferta(grupo, 'b', -1)).toEqual([{ id: 'b', orden: 0 }, { id: 'a', orden: 1 }]);
    expect(moverOferta(grupo, 'a', -1)).toEqual([]);
    expect(moverOferta(grupo, 'c', 1)).toEqual([]);
    const repetidos = [oferta('a', 'A', 0), oferta('b', 'B', 0)];
    expect(moverOferta(repetidos, 'b', -1)).toEqual([{ id: 'b', orden: 0 }, { id: 'a', orden: 1 }].filter((c) => c.id === 'a'));
  });

  it('acciones de estado, precio y cupo', () => {
    expect(accionDeEstado('borrador')?.destino).toBe('publicada');
    expect(accionDeEstado('publicada')?.texto).toBe('Pausar');
    expect(accionDeEstado('pausada')?.texto).toBe('Reanudar');
    expect(precioTexto(oferta('1', 'x', 0, { precioDesde: 160 }))).toEqual({ precio: '$160', unidad: 'por persona' });
    expect(precioTexto(oferta('1', 'x', 0, { precioDesde: null }))).toBeNull();
    const lista = [oferta('1', 'a', 0), oferta('2', 'b', 1, { estado: 'archivada' })];
    expect(cupoOfertas(plan(15, 10), lista)).toEqual({ sinPlan: false, limite: 10, usadas: 1, lleno: false });
    expect(cupoOfertas(plan(3, 0), [])).toMatchObject({ sinPlan: true, lleno: true });
    expect(cupoOfertas(null, lista).limite).toBe(100);
  });
});
