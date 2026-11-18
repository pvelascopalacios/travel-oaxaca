import { HttpErrorResponse } from '@angular/common/http';
import { ReporteMensual } from './modelos';

/** A dónde volver después de ingresar. Solo páginas del propio sitio: cualquier otra cosa se ignora. */
export function destinoSeguro(volver: string | null | undefined): string | null {
  if (!volver) return null;
  // Debe empezar con una sola diagonal y un idioma; '//otro.com' y 'https://…' no pasan.
  return /^\/(es|en)(\/[\w\-./%]*)?(\?[\w\-=&.%]*)?$/.test(volver) && !volver.startsWith('//') ? volver : null;
}

export interface ErrorApi {
  general: string | null;
  campos: Record<string, string>;
}

/** Lo que la API dijo salió mal: un mensaje general y, si hay, un mensaje por campo. */
export function leerError(e: unknown, respaldo: string): ErrorApi {
  if (e instanceof HttpErrorResponse && e.status > 0) {
    const cuerpo = e.error as { mensajes?: string[]; errores?: Record<string, string> } | null;
    const campos = cuerpo?.errores ?? {};
    const general = cuerpo?.mensajes?.[0] ?? (Object.keys(campos).length ? null : respaldo);
    return { general, campos };
  }
  return { general: respaldo, campos: {} };
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

const ACCIONES = ['toque_whatsapp', 'llamada', 'como_llegar', 'guardado', 'compartido', 'clic_web'];

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

export function resumirReporte(r: ReporteMensual): ResumenReporte {
  const porTipo = (r.datos['por_tipo'] ?? {}) as Record<string, unknown>;
  const porOrigen = (r.datos['por_origen'] ?? {}) as Record<string, Record<string, unknown>>;
  const origenes: FilaOrigen[] = Object.entries(porOrigen)
    .map(([clave, o]) => ({ clave, vistas: num(o['vistas']), contactos: num(o['contactos']), porcentaje: num(o['pct_contactos']) }))
    .sort((a, b) => b.contactos - a.contactos || b.vistas - a.vistas);
  // Las vistas salen del conteo por tipo; si falta, de la suma de los orígenes.
  const vistas = num(porTipo['vista_ficha']) || origenes.reduce((s, o) => s + o.vistas, 0);
  const contactos = num(r.datos['contactos_totales']);
  return {
    anio: r.anio,
    mes: r.mes,
    vistas,
    contactos,
    tasa: vistas > 0 ? Math.round((contactos / vistas) * 1000) / 10 : null,
    acciones: ACCIONES.map((tipo) => ({ tipo, total: num(porTipo[tipo]) })).filter((a) => a.total > 0),
    origenes,
    generadoEn: r.generadoEn,
  };
}

/** Cambio porcentual contra el mes anterior; null si no hay con qué comparar. */
export function cambio(actual: number, anterior: number | null | undefined): number | null {
  if (anterior === null || anterior === undefined || anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** El reporte del mes anterior al dado, si está en la lista. */
export function mesAnterior(lista: ReporteMensual[], r: ReporteMensual): ReporteMensual | null {
  const a = r.mes === 1 ? r.anio - 1 : r.anio;
  const m = r.mes === 1 ? 12 : r.mes - 1;
  return lista.find((x) => x.anio === a && x.mes === m) ?? null;
}
