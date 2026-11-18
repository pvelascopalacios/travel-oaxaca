import { Comentario } from './modelos';

export const MAX_COMENTARIO = 1000;
export const MAX_DETALLE_REPORTE = 500;
/** Motivos que acepta la API para reportar una reseña, un comentario o una foto. */
export const MOTIVOS_CONTENIDO = ['ofensivo', 'spam', 'falso', 'derechos', 'otro'] as const;
/** Motivos para reportar un problema de la ficha de un negocio. */
export const MOTIVOS_FICHA = ['cerrado', 'datos_incorrectos', 'ofensivo', 'duplicado', 'otro'] as const;

export function validarComentario(texto: string): 'comentarioVacio' | 'comentarioLargo' | null {
  const t = texto.trim();
  if (!t) return 'comentarioVacio';
  return t.length > MAX_COMENTARIO ? 'comentarioLargo' : null;
}

/** Solo se responde al comentario principal (la API no admite respuestas a respuestas). */
export const puedeResponder = (c: Comentario): boolean => c.padreId === null;

/** Cuántos comentarios hay a la vista, contando respuestas. */
export const totalVisible = (lista: Comentario[]): number => lista.reduce((n, c) => n + 1 + c.respuestas.length, 0);

/** Un comentario principal va al principio; una respuesta, al final de las de su comentario. */
export function insertarComentario(lista: Comentario[], c: Comentario): Comentario[] {
  if (c.padreId === null) return [{ ...c, respuestas: c.respuestas ?? [] }, ...lista];
  return lista.map((p) => (p.id === c.padreId ? { ...p, respuestas: [...p.respuestas, c] } : p));
}

/**
 * Cambia un comentario por su versión nueva. La respuesta de la API al editar no trae las respuestas ni
 * si di «me gusta», así que esos datos se conservan de lo que ya estaba.
 */
export function reemplazarComentario(lista: Comentario[], nuevo: Comentario): Comentario[] {
  const unir = (viejo: Comentario): Comentario => ({ ...nuevo, respuestas: viejo.respuestas, meGusta: viejo.meGusta, yoLeDiMeGusta: viejo.yoLeDiMeGusta });
  return lista.map((c) => (c.id === nuevo.id ? unir(c) : { ...c, respuestas: c.respuestas.map((r) => (r.id === nuevo.id ? unir(r) : r)) }));
}

export function quitarComentario(lista: Comentario[], id: string): Comentario[] {
  return lista.filter((c) => c.id !== id).map((c) => ({ ...c, respuestas: c.respuestas.filter((r) => r.id !== id) }));
}

export function buscarComentario(lista: Comentario[], id: string): Comentario | null {
  for (const c of lista) {
    if (c.id === id) return c;
    const r = c.respuestas.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}

/** Pone el «me gusta» y el total de un comentario (principal o respuesta). */
export function fijarMeGusta(lista: Comentario[], id: string, activo: boolean, total: number): Comentario[] {
  const f = (c: Comentario): Comentario => (c.id === id ? { ...c, yoLeDiMeGusta: activo, meGusta: Math.max(0, total) } : c);
  return lista.map((c) => ({ ...f(c), respuestas: c.respuestas.map(f) }));
}

/** El total que se espera tras alternar, antes de que la API confirme. */
export const totalTrasAlternar = (actual: number, estabaActivo: boolean): number => Math.max(0, actual + (estabaActivo ? -1 : 1));

/** Une a los nuevos sin repetir los que ya estaban (por si se pide la página siguiente tras publicar uno). */
export function unirPagina(actuales: Comentario[], nuevos: Comentario[]): Comentario[] {
  const ids = new Set(actuales.map((c) => c.id));
  return [...actuales, ...nuevos.filter((c) => !ids.has(c.id))];
}

export function validarReporte(motivo: string | null, detalle: string): 'reporteElegirMotivo' | 'reporteDetalleLargo' | null {
  if (!motivo) return 'reporteElegirMotivo';
  return detalle.trim().length > MAX_DETALLE_REPORTE ? 'reporteDetalleLargo' : null;
}
