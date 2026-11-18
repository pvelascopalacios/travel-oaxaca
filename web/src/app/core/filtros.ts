import { ParamMap, Params } from '@angular/router';
import { Categoria, Servicio } from './modelos';

/**
 * Todo lo que el visitante puede ajustar en una lista. Vive en la dirección (?tipo=hotel&wifi…) para que
 * se pueda compartir, guardar y volver con el botón Atrás.
 */
export interface Filtros {
  /** Claves de subcategorías de negocios (hotel, posada, fonda…). Vacío = todas las del grupo. */
  tipos: string[];
  /** Claves de servicios (wifi, desayuno…); el negocio debe tenerlos todos. */
  servicios: string[];
  /** Rango de precio máximo: 1 = $, 2 = $$, 3 = $$$. */
  precio: number | null;
  abierto: boolean;
  /** Códigos de idioma en que atienden (en, es, zap, mix). */
  idiomas: string[];
  orden: Orden;
  /** Lugares: solo entrada gratis. Eventos: solo gratuitos. */
  gratis: boolean;
  /** En Descubrir: qué se está viendo. */
  ver: Ver;
  /** En Descubrir/lugares: tipo de lugar (playa, natural…). */
  tipoLugar: string | null;
  q: string;
  /** Municipio elegido (id) y su nombre para la pastilla. Acota negocios, lugares y eventos. */
  municipio: string | null;
  en: string;
  cerca: boolean;
  mapa: boolean;
  desde: string | null;
  hasta: string | null;
}

export type Orden = 'relevancia' | 'calificacion' | 'precio' | 'distancia' | 'nombre';
export type Ver = 'lugares' | 'tours' | 'eventos';

export const ORDENES: Orden[] = ['relevancia', 'calificacion', 'precio', 'distancia', 'nombre'];
const VERES: Ver[] = ['lugares', 'tours', 'eventos'];
const IDIOMAS_FILTRO = ['es', 'en', 'zap', 'mix'];
export const IDIOMAS_ATENCION = IDIOMAS_FILTRO;

export const FILTROS_VACIOS: Filtros = {
  tipos: [],
  servicios: [],
  precio: null,
  abierto: false,
  idiomas: [],
  orden: 'relevancia',
  gratis: false,
  ver: 'lugares',
  tipoLugar: null,
  q: '',
  municipio: null,
  en: '',
  cerca: false,
  mapa: false,
  desde: null,
  hasta: null,
};

const lista = (v: string | null): string[] => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fechaValida = (v: string | null): string | null => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Lee la dirección. Lo que no se entiende se ignora, nunca se rompe la pantalla. */
export function leerFiltros(p: ParamMap, verPorOmision: Ver = 'lugares'): Filtros {
  const precio = Number(p.get('precio'));
  const orden = p.get('orden') as Orden | null;
  const ver = p.get('ver') as Ver | null;
  return {
    tipos: lista(p.get('tipo')),
    servicios: lista(p.get('servicios')),
    precio: precio >= 1 && precio <= 3 ? Math.trunc(precio) : null,
    abierto: p.get('abierto') === '1',
    idiomas: lista(p.get('idiomas')).filter((i) => IDIOMAS_FILTRO.includes(i)),
    orden: orden && ORDENES.includes(orden) ? orden : 'relevancia',
    gratis: p.get('gratis') === '1',
    ver: ver && VERES.includes(ver) ? ver : verPorOmision,
    tipoLugar: p.get('lugar'),
    q: (p.get('q') ?? '').trim().slice(0, 80),
    municipio: ES_UUID.test(p.get('municipio') ?? '') ? p.get('municipio') : null,
    en: ES_UUID.test(p.get('municipio') ?? '') ? (p.get('en') ?? '').trim().slice(0, 60) : '',
    cerca: p.get('cerca') === '1',
    mapa: p.get('vista') === 'mapa',
    desde: fechaValida(p.get('desde')),
    hasta: fechaValida(p.get('hasta')),
  };
}

/** Escribe solo lo que difiere de lo normal, para direcciones cortas. */
export function aQuery(f: Filtros, verPorOmision: Ver = 'lugares'): Params {
  const q: Params = {};
  if (f.q) q['q'] = f.q;
  if (f.municipio) {
    q['municipio'] = f.municipio;
    if (f.en) q['en'] = f.en;
  }
  if (f.ver !== verPorOmision) q['ver'] = f.ver;
  if (f.tipoLugar) q['lugar'] = f.tipoLugar;
  if (f.tipos.length) q['tipo'] = f.tipos.join(',');
  if (f.servicios.length) q['servicios'] = f.servicios.join(',');
  if (f.precio) q['precio'] = f.precio;
  if (f.abierto) q['abierto'] = 1;
  if (f.idiomas.length) q['idiomas'] = f.idiomas.join(',');
  if (f.gratis) q['gratis'] = 1;
  if (f.cerca) q['cerca'] = 1;
  if (f.desde) q['desde'] = f.desde;
  if (f.hasta) q['hasta'] = f.hasta;
  if (f.orden !== 'relevancia') q['orden'] = f.orden;
  if (f.mapa) q['vista'] = 'mapa';
  return q;
}

/** Número que muestra el botón «Filtros (n)»: lo que el panel puede cambiar, sin contar la vista ni el orden. */
export function contarFiltros(f: Filtros): number {
  return (
    f.tipos.length + f.servicios.length + f.idiomas.length + (f.precio ? 1 : 0) + (f.abierto ? 1 : 0) + (f.gratis ? 1 : 0) +
    (f.desde || f.hasta ? 1 : 0)
  );
}

export function sinFiltros(f: Filtros): Filtros {
  return { ...FILTROS_VACIOS, ver: f.ver, q: f.q, municipio: f.municipio, en: f.en, mapa: f.mapa, orden: f.orden === 'distancia' ? f.orden : 'relevancia', cerca: f.cerca };
}

export function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
}

/** Ids de las subcategorías de las raíces dadas (y de la raíz misma si no tiene hijas). */
export function idsDeRaices(arbol: Categoria[], raices: string[]): { id: string; clave: string }[] {
  const salida: { id: string; clave: string }[] = [];
  for (const r of arbol.filter((c) => raices.includes(c.clave))) {
    if (r.hijas.length === 0) salida.push({ id: r.id, clave: r.clave });
    for (const h of r.hijas) salida.push({ id: h.id, clave: h.clave });
  }
  return salida;
}

/** Servicios que se ofrecen como filtro en cada grupo, en el orden en que se muestran (entre 5 y 10). */
export const SERVICIOS_POR_GRUPO: Record<string, string[]> = {
  dormir: ['wifi', 'desayuno', 'estacionamiento', 'aire_acondicionado', 'alberca', 'mascotas', 'accesible', 'tarjetas'],
  comer: ['vegetariano', 'cocina_tradicional', 'terraza', 'acepta_reservaciones', 'domicilio', 'musica_en_vivo', 'tarjetas', 'solo_efectivo'],
  compras: ['hecho_a_mano', 'taller_visitable', 'envios', 'tarjetas', 'solo_efectivo', 'accesible'],
  descubrir: ['guia_incluido', 'transporte_incluido', 'accesible', 'tarjetas', 'solo_efectivo'],
};

export function serviciosDelGrupo(grupo: string, todos: Servicio[]): Servicio[] {
  const claves = SERVICIOS_POR_GRUPO[grupo] ?? [];
  return claves.map((c) => todos.find((s) => s.clave === c)).filter((s): s is Servicio => !!s);
}

/** Parámetros de GET /publico/negocios para estos filtros. */
export function paramsNegocios(
  f: Filtros,
  contexto: { ids: { id: string; clave: string }[]; servicios: Servicio[]; pagina: number; tamano: number; lat?: number; lng?: number },
): Record<string, string | number | boolean | string[] | undefined> {
  const elegidos = f.tipos.length ? contexto.ids.filter((x) => f.tipos.includes(x.clave)) : contexto.ids;
  const serviciosIds = f.servicios
    .map((c) => contexto.servicios.find((s) => s.clave === c)?.id)
    .filter((x): x is string => !!x);
  const conPunto = f.cerca && contexto.lat !== undefined && contexto.lng !== undefined;
  return {
    q: f.q || undefined,
    municipioId: f.municipio ?? undefined,
    categoriaIds: elegidos.map((x) => x.id),
    precioMax: f.precio ?? undefined,
    servicioIds: serviciosIds,
    idiomas: f.idiomas,
    abiertoAhora: f.abierto ? true : undefined,
    orden: f.orden === 'distancia' && !conPunto ? undefined : f.orden === 'relevancia' ? undefined : f.orden,
    lat: conPunto ? contexto.lat : undefined,
    lng: conPunto ? contexto.lng : undefined,
    cerca: conPunto ? true : undefined,
    pagina: contexto.pagina,
    tamano: contexto.tamano,
  };
}

/** Hoy en hora de México, como AAAA-MM-DD. */
export function hoyMx(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(ahora);
}

/** Fines de semana: sábado y domingo más cercanos (si hoy es sábado o domingo, empieza hoy). */
export function finDeSemanaMx(ahora = new Date()): { desde: string; hasta: string } {
  const hoy = hoyMx(ahora);
  const d = new Date(hoy + 'T00:00:00Z');
  const dia = d.getUTCDay();
  const sumar = (n: number) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  if (dia === 0) return { desde: hoy, hasta: hoy };
  if (dia === 6) return { desde: hoy, hasta: sumar(1) };
  return { desde: sumar(6 - dia), hasta: sumar(7 - dia) };
}
