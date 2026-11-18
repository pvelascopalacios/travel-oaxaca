import { ItemComunidad, SolicitudPrivacidad, UsuarioAdmin } from './modelos';
import { normalizarRol } from './panel';

// ---------------- moderación ----------------

export interface TipoCola {
  clave: string;
  texto: string;
  plural: string;
}

export const TIPOS_COLA: TipoCola[] = [
  { clave: 'resena', texto: 'Reseña', plural: 'Reseñas' },
  { clave: 'comentario', texto: 'Comentario', plural: 'Comentarios' },
  { clave: 'foto', texto: 'Foto de reseña', plural: 'Fotos' },
  { clave: 'reporte_ficha', texto: 'Reporte de ficha', plural: 'Reportes de fichas' },
  { clave: 'reporte_contenido', texto: 'Reporte de contenido', plural: 'Reportes de contenido' },
];

export const tipoColaTexto = (t: string): string => TIPOS_COLA.find((x) => x.clave === t)?.texto ?? t;

const ESTADOS_COLA: Record<string, string> = {
  pendiente: 'pendiente',
  oculta: 'oculta',
  oculto: 'oculto',
  nuevo: 'nuevo',
  en_revision: 'en revisión',
  publicada: 'publicada',
  publicado: 'publicado',
  aprobado: 'aprobada',
};
export const estadoColaTexto = (e: string): string => ESTADOS_COLA[e] ?? e;

export type AccionCola = 'publicar' | 'ocultar' | 'rechazar' | 'aprobar' | 'revisar' | 'resolver' | 'descartar';

export interface AccionDisponible {
  accion: AccionCola;
  texto: string;
  /** primaria = botón lleno; peligro = borde grana. */
  estilo: 'primaria' | 'secundaria' | 'peligro';
  pideMotivo?: boolean;
}

/** Lo que se puede hacer con cada elemento de la cola (la API rechaza repetir un estado, así que no se ofrece). */
export function accionesDe(i: Pick<ItemComunidad, 'tipo' | 'estado'>): AccionDisponible[] {
  switch (i.tipo) {
    case 'resena':
    case 'comentario':
      return [
        { accion: 'publicar', texto: 'Publicar', estilo: 'primaria' },
        ...(i.estado === 'oculta' || i.estado === 'oculto' ? [] : [{ accion: 'ocultar', texto: 'Ocultar', estilo: 'secundaria' } as AccionDisponible]),
        { accion: 'rechazar', texto: 'Rechazar', estilo: 'peligro' },
      ];
    case 'foto':
      return [
        { accion: 'aprobar', texto: 'Aprobar', estilo: 'primaria' },
        { accion: 'rechazar', texto: 'Rechazar…', estilo: 'peligro', pideMotivo: true },
      ];
    case 'reporte_ficha':
    case 'reporte_contenido':
      return [
        ...(i.estado === 'en_revision' ? [] : [{ accion: 'revisar', texto: 'Marcar en revisión', estilo: 'secundaria' } as AccionDisponible]),
        { accion: 'resolver', texto: 'Resolver', estilo: 'primaria' },
        { accion: 'descartar', texto: 'Descartar', estilo: 'secundaria' },
      ];
    default:
      return [];
  }
}

/** Tecla de cada acción: P publica/aprueba/resuelve (la principal), O oculta, R rechaza, D descarta, E marca en revisión. */
export function teclaDe(accion: AccionCola): string {
  switch (accion) {
    case 'publicar': case 'aprobar': case 'resolver': return 'p';
    case 'ocultar': return 'o';
    case 'rechazar': return 'r';
    case 'descartar': return 'd';
    case 'revisar': return 'e';
  }
}

/** La acción que dispara una tecla para este elemento, o null si no ofrece esa acción. */
export function accionPorTecla(i: Pick<ItemComunidad, 'tipo' | 'estado'>, tecla: string): AccionDisponible | null {
  const t = tecla.toLowerCase();
  return accionesDe(i).find((a) => teclaDe(a.accion) === t) ?? null;
}

/** urg = 3 o más reportes · cambio (ámbar) = más de 48 h esperando · '' = normal. */
export function urgenciaComunidad(i: Pick<ItemComunidad, 'reportes'>, horas: number): 'urg' | 'cambio' | '' {
  if (i.reportes >= 3) return 'urg';
  return horas > 48 ? 'cambio' : '';
}

/** Trazo del ícono de cada tipo (viewBox 24, sin relleno). */
export const ICONO_TIPO: Record<string, string> = {
  resena: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  comentario: 'M4 5h16v11H9l-5 4z',
  foto: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM4 18l5-5 4 4 3-3 4 4',
  reporte_ficha: 'M5 21V4M5 4h11l-2 4 2 4H5',
  reporte_contenido: 'M5 21V4M5 4h11l-2 4 2 4H5',
};

/** Ruta de la API para una acción sobre un elemento de la cola. */
export function rutaAccion(tipo: string, id: string, accion: AccionCola): string {
  const base = '/revision/comunidad';
  switch (tipo) {
    case 'resena': return `${base}/resenas/${id}/${accion}`;
    case 'comentario': return `${base}/comentarios/${id}/${accion}`;
    case 'foto': return `${base}/fotos/${id}/${accion}`;
    case 'reporte_ficha': return `${base}/reportes/ficha/${id}/${accion}`;
    default: return `${base}/reportes/contenido/${id}/${accion}`;
  }
}

export const MOTIVO_FOTO_MIN = 5;
export const MOTIVO_FOTO_MAX = 200;
export function errorDeMotivoFoto(m: string): string | null {
  const t = m.trim();
  if (!t) return 'Escribe el motivo.';
  if (t.length < MOTIVO_FOTO_MIN || t.length > MOTIVO_FOTO_MAX) return `El motivo debe tener entre ${MOTIVO_FOTO_MIN} y ${MOTIVO_FOTO_MAX} caracteres.`;
  return null;
}

// ---------------- usuarios y roles ----------------

/** Roles que se dan desde la plataforma. Dueño y colaborador se ligan a un negocio. */
export const ROLES_GLOBALES = ['admin', 'editor', 'ventas'];

export const ESTADOS_USUARIO = [
  { clave: 'activo', texto: 'Activo', clase: 'ok' },
  { clave: 'suspendido', texto: 'Suspendido', clase: 'mal' },
  { clave: 'eliminado', texto: 'Eliminado', clase: 'gris' },
];
export const estadoUsuario = (e: string): { texto: string; clase: string } => ESTADOS_USUARIO.find((x) => x.clave === e) ?? { texto: e, clase: 'gris' };

export const esRolGlobal = (r: string): boolean => ROLES_GLOBALES.includes(normalizarRol(r));

/** Roles que todavía se le pueden agregar. */
export function rolesQueFaltan(u: Pick<UsuarioAdmin, 'roles'>): string[] {
  const tiene = u.roles.map(normalizarRol);
  return ROLES_GLOBALES.filter((r) => !tiene.includes(r));
}

/** Por qué no se puede quitar un rol (null = sí se puede). */
export function motivoNoQuitarRol(u: Pick<UsuarioAdmin, 'id'>, rol: string, yoId: string | null | undefined): string | null {
  if (normalizarRol(rol) === 'admin' && yoId && u.id === yoId) return 'No puedes quitarte a ti mismo el rol de administrador.';
  return null;
}

/** Por qué no se puede cambiar el estado de la cuenta (null = sí se puede). */
export function motivoNoCambiarEstado(u: Pick<UsuarioAdmin, 'id' | 'estado'>, yoId: string | null | undefined): string | null {
  if (yoId && u.id === yoId) return 'No puedes cambiar el estado de tu propia cuenta.';
  if (u.estado === 'eliminado') return 'Esta cuenta fue eliminada.';
  return null;
}

export function iniciales(nombre: string | null | undefined, correo: string): string {
  const base = (nombre ?? '').trim() || correo;
  const partes = base.split(/[\s@._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}

// ---------------- privacidad ----------------

export const TIPOS_SOLICITUD: Record<string, string> = {
  acceso: 'Acceso',
  rectificacion: 'Rectificación',
  cancelacion: 'Cancelación',
  oposicion: 'Oposición',
};
export const tipoSolicitudTexto = (t: string): string => TIPOS_SOLICITUD[t] ?? t;

export const ESTADOS_SOLICITUD = [
  { clave: 'recibida', texto: 'Recibida', clase: 'nueva' },
  { clave: 'en_proceso', texto: 'En proceso', clase: 'cambio' },
  { clave: 'resuelta', texto: 'Resuelta', clase: 'ok' },
  { clave: 'rechazada', texto: 'Rechazada', clase: 'mal' },
];
export const estadoSolicitud = (e: string): { texto: string; clase: string } => ESTADOS_SOLICITUD.find((x) => x.clave === e) ?? { texto: e, clase: 'gris' };

export interface TransicionSolicitud {
  estado: 'en_proceso' | 'resuelta' | 'rechazada';
  texto: string;
  /** Cierra la solicitud: ya no se puede reabrir. */
  cierra: boolean;
  estilo: 'primaria' | 'secundaria' | 'peligro';
}

export function transicionesDe(s: Pick<SolicitudPrivacidad, 'estado'>): TransicionSolicitud[] {
  if (s.estado === 'recibida') {
    return [
      { estado: 'en_proceso', texto: 'Pasar a «En proceso»', cierra: false, estilo: 'primaria' },
      { estado: 'resuelta', texto: 'Marcar resuelta', cierra: true, estilo: 'secundaria' },
      { estado: 'rechazada', texto: 'Rechazar', cierra: true, estilo: 'peligro' },
    ];
  }
  if (s.estado === 'en_proceso') {
    return [
      { estado: 'resuelta', texto: 'Marcar resuelta', cierra: true, estilo: 'primaria' },
      { estado: 'rechazada', texto: 'Rechazar', cierra: true, estilo: 'peligro' },
    ];
  }
  return [];
}
