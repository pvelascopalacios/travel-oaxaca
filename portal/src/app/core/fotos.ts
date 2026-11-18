import { MedioFicha, PlanNegocio } from './modelos';

/** Lo mismo que valida la API (application.yml): 10 MB por foto y 20 por ficha; además cada plan trae su cupo. */
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_FOTOS = 20;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

export function pesoTexto(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.0', '') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/** Por qué no se puede subir este archivo (o null si está bien). La API vuelve a validar igual. */
export function errorDeArchivo(a: { type: string; size: number }): string | null {
  if (!TIPOS_FOTO.includes(a.type)) return 'Solo se aceptan fotos JPEG, PNG o WebP.';
  if (a.size <= 0) return 'El archivo está vacío.';
  if (a.size > MAX_BYTES) return `La foto pesa demasiado. El máximo es ${MAX_BYTES / 1048576} MB.`;
  return null;
}

export interface Cupo {
  /** Máximo de fotos que admite este negocio (el menor entre el plan y el tope de la ficha). */
  maximo: number;
  restante: number;
  lleno: boolean;
}

/** Cuántas fotos más caben. Sin datos del plan solo se aplica el tope de la ficha; la API decide al final. */
export function cupoFotos(total: number, plan: PlanNegocio | null): Cupo {
  const maximo = Math.min(MAX_FOTOS, plan?.plan.limiteFotos ?? MAX_FOTOS);
  const restante = Math.max(0, maximo - total);
  return { maximo, restante, lleno: restante === 0 };
}

export function moderacionInfo(m: string): { texto: string; clase: 'ok' | 'rev' | 'no' | 'otro' } {
  switch (m) {
    case 'aprobado': return { texto: 'Aprobada', clase: 'ok' };
    case 'pendiente': return { texto: 'En revisión', clase: 'rev' };
    case 'rechazado': return { texto: 'Rechazada', clase: 'no' };
    default: return { texto: m, clase: 'otro' };
  }
}

/** Fotos en el orden guardado (por `orden`). */
export function enOrden(medios: MedioFicha[] | null | undefined): MedioFicha[] {
  return [...(medios ?? [])].sort((a, b) => a.orden - b.orden);
}

export function portadaDe(medios: MedioFicha[]): string | null {
  return medios.find((m) => m.esPortada)?.medioId ?? null;
}

/** Mueve el elemento `i` una posición (-1 antes, +1 después). Fuera de rango devuelve la misma lista. */
export function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** ¿Cambió el orden o la portada respecto de lo guardado? */
export function hayCambiosDeOrden(actual: string[], portadaActual: string | null, guardadas: MedioFicha[]): boolean {
  const g = enOrden(guardadas);
  if (actual.length !== g.length) return true;
  return actual.some((id, i) => id !== g[i].medioId) || portadaActual !== portadaDe(g);
}
