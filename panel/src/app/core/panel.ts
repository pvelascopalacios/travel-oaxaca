import { HttpErrorResponse } from '@angular/common/http';
import { Categoria, ColaItem, Historial, Promocion } from './modelos';

// ---------------- roles ----------------

export const ROLES_PANEL = ['admin', 'editor', 'ventas'];

/** Quita el prefijo ROLE_ y pasa a minúsculas: «ROLE_ADMIN» y «admin» son el mismo rol. */
export const normalizarRol = (r: string): string => r.replace(/^ROLE_/i, '').trim().toLowerCase();

export function tieneAlgunRol(roles: string[] | null | undefined, buscados: string[]): boolean {
  const mios = (roles ?? []).map(normalizarRol);
  return buscados.some((b) => mios.includes(b));
}

export function rolTexto(r: string): string {
  switch (normalizarRol(r)) {
    case 'admin': return 'Administración';
    case 'editor': return 'Edición';
    case 'ventas': return 'Ventas';
    default: return r;
  }
}

/** El rol más alto de la persona, para la etiqueta del menú. */
export function rolPrincipal(roles: string[] | null | undefined): string | null {
  for (const r of ['admin', 'editor', 'ventas']) if (tieneAlgunRol(roles, [r])) return r;
  return null;
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

/** Destino de «volver» después de ingresar: solo rutas internas del panel. */
export function destinoSeguro(volver: string | null | undefined): string | null {
  if (!volver) return null;
  return /^\/[\w\-./%]*(\?[\w\-=&.%]*)?$/.test(volver) && !volver.startsWith('//') ? volver : null;
}

// ---------------- formato ----------------

export function fechaCorta(iso: string | null | undefined, opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', opciones).replace(/\./g, '');
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '');
}

/** «9 h», «2 d 7 h», «6 d». */
export function esperaTexto(horas: number): string {
  const h = Math.max(0, Math.floor(horas));
  if (h < 1) return 'Menos de 1 h';
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d} d ${r} h` : `${d} d`;
}

// ---------------- cola ----------------

export interface Info {
  texto: string;
  clase: string;
}

export function urgenciaInfo(u: string): Info {
  switch (u) {
    case 'urgente': return { texto: 'Urgente', clase: 'urg' };
    case 'atencion': return { texto: 'Atención', clase: 'cambio' };
    default: return { texto: 'Normal', clase: 'ok' };
  }
}

export function tipoColaInfo(t: string): Info & { sigla: string } {
  switch (t) {
    case 'ficha_nueva': return { texto: 'Ficha nueva', clase: 'nueva', sigla: 'FICHA' };
    case 'cambio': return { texto: 'Cambios', clase: 'cambio', sigla: 'CAMBIO' };
    case 'foto': return { texto: 'Foto', clase: 'gris', sigla: 'FOTO' };
    default: return { texto: t, clase: 'gris', sigla: '—' };
  }
}

/** Pestañas de la cola. Las promociones tienen su propia lista en la API. */
export const PESTANAS = [
  { clave: '', texto: 'Todo' },
  { clave: 'ficha_nueva', texto: 'Fichas nuevas' },
  { clave: 'cambio', texto: 'Cambios' },
  { clave: 'foto', texto: 'Fotos' },
  { clave: 'promociones', texto: 'Promociones' },
] as const;

export function resultadoInfo(r: string): Info {
  return /^aprobad/.test(r) ? { texto: 'Aprobada', clase: 'ok' } : /^rechazad/.test(r) ? { texto: 'Rechazada', clase: 'mal' } : { texto: r, clase: 'gris' };
}

export const tipoHistorialTexto = (h: Pick<Historial, 'tipo'>): string => tipoColaInfo(h.tipo).texto;

/** Una ficha nueva, un cambio o una foto: lo que se muestra como título de la tarjeta. */
export const clavePendiente = (i: ColaItem): string => `${i.tipo}:${i.medioId ?? i.negocioId}`;

// ---------------- categorías ----------------

export function nombreCategoria(arbol: Categoria[], clave: string): string {
  const buscar = (l: Categoria[]): string | null => {
    for (const c of l) {
      if (c.clave === clave) return c.nombre;
      const h = buscar(c.hijas ?? []);
      if (h) return h;
    }
    return null;
  };
  return buscar(arbol) ?? (clave ? clave.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()) : '');
}

export function nombreCategoriaPorId(arbol: Categoria[], id: string): string | null {
  for (const c of arbol) {
    if (c.id === id) return c.nombre;
    const h = nombreCategoriaPorId(c.hijas ?? [], id);
    if (h) return h;
  }
  return null;
}

/** Categorías sin hijas, para el filtro, con el nombre de su grupo. */
export function categoriasPlanas(arbol: Categoria[]): { id: string; etiqueta: string }[] {
  const salida: { id: string; etiqueta: string }[] = [];
  const recorrer = (c: Categoria, padre: string | null) => {
    if (c.hijas?.length) c.hijas.forEach((h) => recorrer(h, c.nombre));
    else salida.push({ id: c.id, etiqueta: padre ? `${padre} › ${c.nombre}` : c.nombre });
  };
  arbol.forEach((c) => recorrer(c, null));
  return salida.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

// ---------------- cambios propuestos ----------------

export interface Linea {
  nombre: string | null;
  texto: string;
}

export interface FilaCambio {
  clave: string;
  etiqueta: string;
  antes: Linea[];
  despues: Linea[];
}

const SUBCAMPOS: Record<string, string> = {
  descripcionCorta: 'Descripción corta',
  descripcion: 'Descripción',
  politicas: 'Políticas',
  latitud: 'Latitud',
  longitud: 'Longitud',
};

const IDIOMAS: Record<string, string> = { es: 'español', en: 'inglés', zap: 'zapoteco', mix: 'mixteco' };

export function etiquetaCampo(clave: string): string {
  if (clave === 'nombre_comercial') return 'Nombre comercial';
  if (clave === 'categoria_id') return 'Categoría';
  if (clave === 'sucursal_principal_ubicacion') return 'Ubicación en el mapa';
  if (clave.startsWith('traduccion.')) {
    const i = clave.slice('traduccion.'.length);
    return `Textos (${IDIOMAS[i] ?? i})`;
  }
  const t = clave.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function lineas(valor: unknown, arbol: Categoria[], clave: string): Linea[] {
  if (valor === null || valor === undefined || valor === '') return [{ nombre: null, texto: '—' }];
  if (clave === 'categoria_id' && typeof valor === 'string') return [{ nombre: null, texto: nombreCategoriaPorId(arbol, valor) ?? 'Otra categoría' }];
  if (typeof valor === 'object' && !Array.isArray(valor)) {
    const salida: Linea[] = [];
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue;
      salida.push({ nombre: SUBCAMPOS[k] ?? k, texto: String(v) });
    }
    return salida.length ? salida : [{ nombre: null, texto: '—' }];
  }
  return [{ nombre: null, texto: String(valor) }];
}

/** Cambios propuestos como filas «antes → después». Un cambio incompleto (sin «después») se marca para rechazarlo. */
export function filasDeCambios(cambios: Record<string, unknown> | null | undefined, arbol: Categoria[] = []): (FilaCambio & { incompleto: boolean })[] {
  if (!cambios) return [];
  return Object.entries(cambios).map(([clave, v]) => {
    const par = (v && typeof v === 'object' ? v : {}) as { antes?: unknown; despues?: unknown };
    return {
      clave,
      etiqueta: etiquetaCampo(clave),
      antes: lineas(par.antes, arbol, clave),
      despues: lineas(par.despues, arbol, clave),
      incompleto: !('despues' in par),
    };
  });
}

// ---------------- motivo de rechazo ----------------

export interface LimiteMotivo {
  min: number;
  max: number;
}
export const MOTIVO_FICHA: LimiteMotivo = { min: 10, max: 1000 };
export const MOTIVO_PROMOCION: LimiteMotivo = { min: 1, max: 300 };

export function errorDeMotivo(m: string, l: LimiteMotivo): string | null {
  const t = m.trim();
  if (!t) return 'Escribe el motivo del rechazo.';
  if (t.length < l.min) return `El motivo debe tener al menos ${l.min} caracteres.`;
  if (t.length > l.max) return `El motivo puede tener hasta ${l.max} caracteres.`;
  return null;
}

// ---------------- promociones ----------------

export function valorPromo(p: Pick<Promocion, 'tipo' | 'valor'>): string {
  const n = (x: number | null) => Number(x ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  switch (p.tipo) {
    case 'descuento_pct': return `${n(p.valor)} %`;
    case 'descuento_monto': return `$${n(p.valor)}`;
    case 'dos_por_uno': return '2×1';
    default: return 'Regalo';
  }
}

export function tituloPromo(p: Promocion): string {
  return p.textos.find((t) => t.idioma === 'es')?.titulo ?? p.textos[0]?.titulo ?? '(sin título)';
}

export function periodoPromo(p: Pick<Promocion, 'inicio' | 'fin'>): string {
  const mismo = p.inicio.slice(0, 4) === p.fin.slice(0, 4);
  const corta = fechaCorta(p.inicio, { day: 'numeric', month: 'short', ...(mismo ? {} : { year: 'numeric' }) });
  return `${corta} – ${fechaCorta(p.fin)}`;
}
