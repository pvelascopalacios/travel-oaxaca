import { ListaElemento, ListaEntrada, ListaResumen, TipoElemento } from './modelos';

export const MAX_NOMBRE_LISTA = 80;
export const MAX_NOTA = 300;

export interface ErroresLista {
  nombre?: 'listaNombreVacio' | 'listaNombreLargo';
  fechaFin?: 'listaFechasInvertidas';
}

/** Valida el formulario de lista. Las fechas solo cuentan en un itinerario. */
export function validarLista(nombre: string, esItinerario: boolean, inicio: string, fin: string): ErroresLista {
  const e: ErroresLista = {};
  const n = nombre.trim();
  if (!n) e.nombre = 'listaNombreVacio';
  else if (n.length > MAX_NOMBRE_LISTA) e.nombre = 'listaNombreLargo';
  if (esItinerario && inicio && fin && fin < inicio) e.fechaFin = 'listaFechasInvertidas';
  return e;
}

/** Lo que se manda a la API; una lista normal nunca lleva fechas. */
export function entradaDeLista(nombre: string, esItinerario: boolean, inicio: string, fin: string, publica: boolean): ListaEntrada {
  return { nombre: nombre.trim(), esItinerario, fechaInicio: esItinerario && inicio ? inicio : null, fechaFin: esItinerario && fin ? fin : null, publica };
}

const MS_DIA = 86_400_000;
const aUtc = (iso: string): number => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');

/** Cuántos días abarcan las fechas (ambas incluidas); null si falta alguna o están al revés. */
export function diasDeItinerario(inicio: string | null, fin: string | null): number | null {
  if (!inicio || !fin) return null;
  const d = Math.round((aUtc(fin) - aUtc(inicio)) / MS_DIA) + 1;
  return d >= 1 ? d : null;
}

/** La fecha del día N (1 es el primero) de un itinerario que empieza en `inicio`. */
export function fechaDelDia(inicio: string | null, dia: number): string | null {
  if (!inicio) return null;
  return new Date(aUtc(inicio) + (dia - 1) * MS_DIA).toISOString().slice(0, 10);
}

export interface GrupoDia {
  /** null = sin día asignado (o toda la lista, si no es itinerario). */
  dia: number | null;
  fecha: string | null;
  elementos: ListaElemento[];
}

const porOrden = (a: ListaElemento, b: ListaElemento): number => a.orden - b.orden || a.nombre.localeCompare(b.nombre);

/**
 * Agrupa los elementos para pintarlos. En un itinerario hay un grupo por cada día del rango (aunque esté vacío)
 * y por cada día que ya tenga elementos; los que no tienen día van al final.
 */
export function agruparPorDia(elementos: ListaElemento[], esItinerario: boolean, inicio: string | null, fin: string | null): GrupoDia[] {
  if (!esItinerario) return [{ dia: null, fecha: null, elementos: [...elementos].sort(porOrden) }];
  const usados = elementos.map((e) => e.dia).filter((d): d is number => d !== null && d >= 1);
  const total = Math.max(diasDeItinerario(inicio, fin) ?? 0, ...usados, 0);
  const grupos: GrupoDia[] = [];
  for (let d = 1; d <= total; d++) {
    grupos.push({ dia: d, fecha: fechaDelDia(inicio, d), elementos: elementos.filter((e) => e.dia === d).sort(porOrden) });
  }
  const sueltos = elementos.filter((e) => e.dia === null || e.dia < 1).sort(porOrden);
  if (sueltos.length || !grupos.length) grupos.push({ dia: null, fecha: null, elementos: sueltos });
  return grupos;
}

export interface CambioOrden {
  itemId: string;
  orden: number;
}

/**
 * Subir (-1) o bajar (+1) un elemento dentro de su grupo. Regresa los elementos cuyo orden cambia
 * (el grupo se renumera 0, 1, 2… para no depender de huecos ni repetidos); [] si ya está en el extremo.
 */
export function moverEnGrupo(grupo: ListaElemento[], itemId: string, dir: -1 | 1): CambioOrden[] {
  const l = [...grupo].sort(porOrden);
  const i = l.findIndex((e) => e.itemId === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return [];
  [l[i], l[j]] = [l[j], l[i]];
  return l.map((e, k) => ({ itemId: e.itemId, orden: k })).filter((c) => grupo.find((e) => e.itemId === c.itemId)?.orden !== c.orden);
}

export function rutaDeElemento(e: { tipo: TipoElemento; slug: string }, idioma: string): string[] {
  return ['/', idioma, e.tipo, e.slug];
}

export function claveTipoElemento(t: TipoElemento): 'listaTipoNegocio' | 'listaTipoLugar' | 'listaTipoRuta' {
  return t === 'negocio' ? 'listaTipoNegocio' : t === 'lugar' ? 'listaTipoLugar' : 'listaTipoRuta';
}

/** «14–16 nov 2026» sin repetir lo que se repite; formato lo pone el llamador con su idioma. */
export function rangoFechas(inicio: string | null, fin: string | null, fmt: (iso: string) => string): string | null {
  if (inicio && fin) return inicio === fin ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fin)}`;
  const uno = inicio ?? fin;
  return uno ? fmt(uno) : null;
}

/** Las listas, de la última que se creó a la primera. */
export function ordenarListas(l: ListaResumen[]): ListaResumen[] {
  return [...l].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/** ¿Ya no se pueden crear más listas? (el tope real lo manda la API; esto solo avisa antes). */
export const TOPE_LISTAS = 20;

/** Estado de una reseña propia → texto y clase. */
export function estadoResena(estado: string | null): { clave: 'misResenasPublicada' | 'misResenasRevision' | 'misResenasRechazada'; clase: 'ok' | 'espera' | 'no' } {
  switch (estado) {
    case 'rechazada': case 'oculta': return { clave: 'misResenasRechazada', clase: 'no' };
    case 'pendiente': return { clave: 'misResenasRevision', clase: 'espera' };
    default: return { clave: 'misResenasPublicada', clase: 'ok' };
  }
}

export const hayErroresLista = (e: ErroresLista): boolean => Object.keys(e).length > 0;
