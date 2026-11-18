import { Consentimiento, EstadoSolicitud, SesionActiva, SolicitudPrivacidad, TipoConsentimiento, TipoSolicitud } from './modelos';

export const TIPOS_SOLICITUD: TipoSolicitud[] = ['acceso', 'rectificacion', 'cancelacion', 'oposicion'];
/** Preferencias que la persona puede activar o retirar; privacidad y términos se aceptan al registrarse. */
export const PREFERENCIAS: TipoConsentimiento[] = ['analitica', 'marketing'];
export const IDIOMAS_PERFIL = ['es', 'en'] as const;

const TELEFONO = /^\+[1-9][0-9]{7,14}$/;

/** Quita espacios, guiones y paréntesis; «+52 954 123 4567» → «+529541234567». Vacío → null. */
export function normalizarTelefono(texto: string): string | null {
  const t = texto.replace(/[\s\-().]/g, '');
  return t === '' ? null : t;
}

export interface ErroresPerfil {
  nombre?: 'perfilNombreVacio' | 'perfilNombreLargo';
  telefono?: 'perfilTelefonoInvalido';
}

export function validarPerfil(nombre: string, telefono: string): ErroresPerfil {
  const e: ErroresPerfil = {};
  const n = nombre.trim();
  if (!n) e.nombre = 'perfilNombreVacio';
  else if (n.length > 120) e.nombre = 'perfilNombreLargo';
  const t = normalizarTelefono(telefono);
  if (t !== null && !TELEFONO.test(t)) e.telefono = 'perfilTelefonoInvalido';
  return e;
}

export interface ErroresClave {
  actual?: 'perfilClaveActualVacia';
  nueva?: 'perfilClaveNuevaVacia' | 'perfilClaveIgual' | 'perfilClaveLarga';
  repetir?: 'perfilClaveNoCoincide';
}

export function validarClave(actual: string, nueva: string, repetir: string): ErroresClave {
  const e: ErroresClave = {};
  if (!actual) e.actual = 'perfilClaveActualVacia';
  if (!nueva) e.nueva = 'perfilClaveNuevaVacia';
  else if (nueva.length > 128) e.nueva = 'perfilClaveLarga';
  else if (nueva === actual) e.nueva = 'perfilClaveIgual';
  if (nueva && repetir !== nueva) e.repetir = 'perfilClaveNoCoincide';
  return e;
}

export const hayErrores = (e: object): boolean => Object.keys(e).length > 0;

/** Primeras letras del nombre para el círculo del encabezado; nunca vacío. */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/** La sesión de este navegador primero; las demás, de la más reciente a la más antigua. */
export function ordenarSesiones(lista: SesionActiva[]): SesionActiva[] {
  return [...lista].sort((a, b) => Number(b.actual) - Number(a.actual) || b.creadoEn.localeCompare(a.creadoEn));
}

export const otrasSesiones = (lista: SesionActiva[]): SesionActiva[] => lista.filter((s) => !s.actual);

export type PlataformaConocida = 'web' | 'android' | 'ios';
export function plataformaClave(p: string): 'perfilPlataformaWeb' | 'perfilPlataformaAndroid' | 'perfilPlataformaIos' | 'perfilPlataformaOtra' {
  switch (p.toLowerCase()) {
    case 'web': return 'perfilPlataformaWeb';
    case 'android': return 'perfilPlataformaAndroid';
    case 'ios': return 'perfilPlataformaIos';
    default: return 'perfilPlataformaOtra';
  }
}

/** Lo vigente de cada preferencia: manda el registro más reciente; si nunca se tocó, está desactivada. */
export function consentimientoVigente(lista: Consentimiento[], tipo: TipoConsentimiento): boolean {
  const mios = lista.filter((c) => c.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return mios[0]?.aceptado ?? false;
}

/** Fecha del último cambio de una preferencia, o null si nunca se tocó. */
export function fechaConsentimiento(lista: Consentimiento[], tipo: TipoConsentimiento): string | null {
  return lista.filter((c) => c.tipo === tipo).map((c) => c.fecha).sort().at(-1) ?? null;
}

const CLASE_ESTADO: Record<EstadoSolicitud, 'espera' | 'proceso' | 'ok' | 'no'> = {
  recibida: 'espera', en_proceso: 'proceso', resuelta: 'ok', rechazada: 'no',
};
export const claseEstado = (e: EstadoSolicitud): 'espera' | 'proceso' | 'ok' | 'no' => CLASE_ESTADO[e] ?? 'espera';

/** Solicitudes de la más nueva a la más vieja. */
export function ordenarSolicitudes(lista: SolicitudPrivacidad[]): SolicitudPrivacidad[] {
  return [...lista].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/** Una solicitud del mismo tipo ya está abierta: se avisa antes de duplicarla. */
export function solicitudAbierta(lista: SolicitudPrivacidad[], tipo: TipoSolicitud): boolean {
  return lista.some((s) => s.tipo === tipo && (s.estado === 'recibida' || s.estado === 'en_proceso'));
}

/** Solo la parte de fecha (AAAA-MM-DD) de una marca de tiempo ISO. */
export const soloFecha = (iso: string): string => iso.slice(0, 10);
