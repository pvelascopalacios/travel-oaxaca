import { HttpErrorResponse } from '@angular/common/http';
import { Categoria, Metricas, ReporteMensual } from './modelos';

// ---------------- estados y roles ----------------

export interface EstadoInfo {
  texto: string;
  clase: 'publicada' | 'borrador' | 'en_revision' | 'pausada' | 'archivada';
}

const ESTADOS: Record<string, EstadoInfo> = {
  publicada: { texto: 'Publicada', clase: 'publicada' },
  borrador: { texto: 'Borrador', clase: 'borrador' },
  en_revision: { texto: 'En revisión', clase: 'en_revision' },
  pausada: { texto: 'Pausada', clase: 'pausada' },
  archivada: { texto: 'Archivada', clase: 'archivada' },
};

export function estadoInfo(estado: string): EstadoInfo {
  return ESTADOS[estado] ?? { texto: estado, clase: 'borrador' };
}

export function rolTexto(rol: string | null | undefined): string {
  return rol === 'propietario' ? 'Propietario' : rol === 'colaborador' ? 'Colaborador' : '';
}

/** Solo el propietario pausa, reanuda y archiva. */
export const esPropietario = (rol: string | null | undefined): boolean => rol === 'propietario';

export function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? '?').toUpperCase();
}

// ---------------- categorías ----------------

export interface OpcionCategoria {
  id: string;
  clave: string;
  etiqueta: string;
}

/** Las categorías que se pueden elegir: las que no tienen hijas, con el nombre de su grupo («Artesanías › Barro negro»). */
export function categoriasElegibles(arbol: Categoria[]): OpcionCategoria[] {
  const salida: OpcionCategoria[] = [];
  const recorrer = (c: Categoria, padre: string | null) => {
    if (c.hijas?.length) c.hijas.forEach((h) => recorrer(h, c.nombre));
    else salida.push({ id: c.id, clave: c.clave, etiqueta: padre ? `${padre} › ${c.nombre}` : c.nombre });
  };
  arbol.forEach((c) => recorrer(c, null));
  return salida.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/** Nombre de una categoría por su clave; si no está en el catálogo, la clave legible. */
export function nombreCategoria(opciones: OpcionCategoria[], clave: string): string {
  const o = opciones.find((x) => x.clave === clave);
  if (o) return o.etiqueta.split(' › ').pop() ?? o.etiqueta;
  const t = clave.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------- errores ----------------

export interface ErrorApi {
  general: string | null;
  campos: Record<string, string>;
}

/** Lo que dijo la API (un mensaje general y, si hay, uno por campo). Sin conexión: el mensaje de respaldo. */
export function leerError(e: unknown, respaldo = 'No pudimos completar esto. Revisa tu conexión e inténtalo de nuevo.'): ErrorApi {
  if (e instanceof HttpErrorResponse && e.status > 0) {
    const cuerpo = e.error as { mensajes?: string[]; errores?: Record<string, string> } | null;
    const campos = cuerpo?.errores ?? {};
    const general = cuerpo?.mensajes?.[0] ?? (Object.keys(campos).length ? null : respaldo);
    return { general, campos };
  }
  return { general: respaldo, campos: {} };
}

/** Destino de «volver» después de ingresar: solo rutas internas del portal. */
export function destinoSeguro(volver: string | null | undefined): string | null {
  if (!volver) return null;
  return /^\/[\w\-./%]*(\?[\w\-=&.%]*)?$/.test(volver) && !volver.startsWith('//') ? volver : null;
}

// ---------------- métricas ----------------

/** Cambio porcentual contra el periodo anterior; null si no hay con qué comparar. */
export function cambio(actual: number, anterior: number | null | undefined): number | null {
  if (anterior === null || anterior === undefined || anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** Diferencia en puntos de la tasa de contacto; null si falta alguna. */
export function cambioPuntos(actual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (actual == null || anterior == null) return null;
  return Math.round((actual - anterior) * 10) / 10;
}

export function flecha(n: number): string {
  return (n > 0 ? '▲ ' : n < 0 ? '▼ ' : '') + Math.abs(n);
}

const ACCIONES: Record<string, string> = {
  toque_whatsapp: 'Toques de WhatsApp',
  llamada: 'Llamadas',
  como_llegar: 'Cómo llegar',
  guardado: 'Guardados',
  compartido: 'Veces compartida',
  clic_web: 'Clics a tu sitio web',
};

export function nombreAccion(tipo: string): string {
  return ACCIONES[tipo] ?? tipo.replace(/_/g, ' ');
}

/** Las acciones con resultados, en el orden en que se explican (no incluye las vistas). */
export function accionesConResultado(m: Metricas): { tipo: string; nombre: string; total: number }[] {
  const orden = Object.keys(ACCIONES);
  return (m.porTipo ?? [])
    .filter((x) => x.total > 0 && x.tipo in ACCIONES)
    .sort((a, b) => b.total - a.total || orden.indexOf(a.tipo) - orden.indexOf(b.tipo))
    .map((x) => ({ ...x, nombre: nombreAccion(x.tipo) }));
}

export interface Trazo {
  vistas: string;
  contactos: string;
  /** Primer y último día de la serie, para rotular el eje. */
  desde: string;
  hasta: string;
  maximo: number;
}

/** Puntos de las dos líneas (vistas y contactos, en la misma escala) para dibujar en un SVG de ancho × alto. */
export function trazar(serie: { dia: string; vistas: number; contactos: number }[], ancho: number, alto: number): Trazo | null {
  if (serie.length < 2) return null;
  const maximo = Math.max(1, ...serie.map((p) => p.vistas), ...serie.map((p) => p.contactos));
  const margen = 8;
  const punto = (i: number, v: number) =>
    `${((i * ancho) / (serie.length - 1)).toFixed(1)},${(alto - margen - (v / maximo) * (alto - margen * 2)).toFixed(1)}`;
  return {
    vistas: serie.map((p, i) => punto(i, p.vistas)).join(' '),
    contactos: serie.map((p, i) => punto(i, p.contactos)).join(' '),
    desde: serie[0].dia,
    hasta: serie[serie.length - 1].dia,
    maximo,
  };
}

// ---------------- reporte mensual ----------------

export interface FilaOrigen {
  clave: string;
  vistas: number;
  contactos: number;
  porcentaje: number;
}

export interface ResumenReporte {
  anio: number;
  mes: number;
  vistas: number;
  contactos: number;
  tasa: number | null;
  acciones: { tipo: string; total: number }[];
  origenes: FilaOrigen[];
  generadoEn: string;
}

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

export function resumirReporte(r: ReporteMensual): ResumenReporte {
  const porTipo = (r.datos['por_tipo'] ?? {}) as Record<string, unknown>;
  const porOrigen = (r.datos['por_origen'] ?? {}) as Record<string, Record<string, unknown>>;
  const origenes: FilaOrigen[] = Object.entries(porOrigen)
    .map(([clave, o]) => ({ clave, vistas: num(o['vistas']), contactos: num(o['contactos']), porcentaje: num(o['pct_contactos']) }))
    .sort((a, b) => b.contactos - a.contactos || b.vistas - a.vistas);
  const vistas = num(porTipo['vista_ficha']) || origenes.reduce((s, o) => s + o.vistas, 0);
  const contactos = num(r.datos['contactos_totales']);
  return {
    anio: r.anio,
    mes: r.mes,
    vistas,
    contactos,
    tasa: vistas > 0 ? Math.round((contactos / vistas) * 1000) / 10 : null,
    acciones: Object.keys(ACCIONES).map((tipo) => ({ tipo, total: num(porTipo[tipo]) })).filter((a) => a.total > 0),
    origenes,
    generadoEn: r.generadoEn,
  };
}

export function mesAnterior(lista: ReporteMensual[], r: ReporteMensual): ReporteMensual | null {
  const a = r.mes === 1 ? r.anio - 1 : r.anio;
  const m = r.mes === 1 ? 12 : r.mes - 1;
  return lista.find((x) => x.anio === a && x.mes === m) ?? null;
}

export const ORIGENES: Record<string, string> = {
  app: 'Travel Oaxaca (app)',
  oaxaca_explora: 'Oaxaca Explora',
  enlace_directo: 'Enlace directo',
  compartido: 'Enlace compartido',
  afiliado: 'Recomendado por un aliado',
  otro: 'Otro',
};

// ---------------- formato ----------------

export const numero = (n: number): string => n.toLocaleString('es-MX');

export function fechaCorta(iso: string, opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', opciones);
}
