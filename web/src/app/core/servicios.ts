import { ServicioTarjeta } from './modelos';

export interface EtiquetaServicio {
  clave: string;
  nombre: string;
  /** Coincide con un filtro de servicios activo. */
  resaltada: boolean;
}

/** Cuántas etiquetas caben en una tarjeta. */
export const MAX_ETIQUETAS = 3;

/**
 * Las etiquetas que se ven en una tarjeta: primero las que coinciden con el filtro de la persona (resaltadas),
 * luego las demás en su orden, sin repetir y sin pasar de `max`.
 */
export function etiquetasVisibles(servicios: readonly ServicioTarjeta[] | null | undefined, resaltar: readonly string[] = [], max = MAX_ETIQUETAS): EtiquetaServicio[] {
  const vistos = new Set<string>();
  const todos: EtiquetaServicio[] = [];
  for (const s of servicios ?? []) {
    if (!s.nombre || vistos.has(s.clave)) continue;
    vistos.add(s.clave);
    todos.push({ clave: s.clave, nombre: s.nombre, resaltada: resaltar.includes(s.clave) });
  }
  return [...todos.filter((e) => e.resaltada), ...todos.filter((e) => !e.resaltada)].slice(0, Math.max(0, max));
}
