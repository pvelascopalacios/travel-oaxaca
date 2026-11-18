import { Categoria, MunicipioOpcion } from './modelos';

export const MAX_MENSAJE_CONTACTO = 500;

export interface BorradorContacto {
  nombreNegocio: string;
  contactoNombre: string;
  telefono: string;
  correo: string;
  mensaje: string;
  municipioTexto: string;
}

export type ErroresContacto = Partial<Record<'nombreNegocio' | 'contacto' | 'mensaje', 'ctNombreFalta' | 'ctContactoFalta' | 'ctMensajeLargo'>>;

/** Lo mínimo que se revisa antes de enviar; el resto lo valida la API (teléfono, correo, repetidos). */
export function validarContacto(b: BorradorContacto): ErroresContacto {
  const e: ErroresContacto = {};
  if (!b.nombreNegocio.trim()) e.nombreNegocio = 'ctNombreFalta';
  if (!b.telefono.trim() && !b.correo.trim()) e.contacto = 'ctContactoFalta';
  if (b.mensaje.trim().length > MAX_MENSAJE_CONTACTO) e.mensaje = 'ctMensajeLargo';
  return e;
}

export const hayErroresContacto = (e: ErroresContacto): boolean => Object.keys(e).length > 0;

/** Categorías para el selector: las que tienen hijas se muestran como grupo y se elige una hija. */
export function opcionesCategoria(arbol: Categoria[]): { grupo: string | null; items: { id: string; nombre: string }[] }[] {
  const grupos: { grupo: string | null; items: { id: string; nombre: string }[] }[] = [];
  const sueltas: { id: string; nombre: string }[] = [];
  for (const c of arbol) {
    if (c.hijas?.length) grupos.push({ grupo: c.nombre, items: c.hijas.map((h) => ({ id: h.id, nombre: h.nombre })) });
    else sueltas.push({ id: c.id, nombre: c.nombre });
  }
  return sueltas.length ? [{ grupo: null, items: sueltas }, ...grupos] : grupos;
}

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** El municipio que escribió la persona, si coincide con uno de la lista (sin importar acentos ni mayúsculas). */
export function municipioElegido(texto: string, lista: MunicipioOpcion[]): MunicipioOpcion | null {
  const t = sinAcentos(texto);
  return t ? (lista.find((m) => sinAcentos(m.nombre) === t) ?? null) : null;
}

/** El mensaje que se envía: si escribió un municipio que no está en la lista, se conserva dentro del mensaje. */
export function mensajeFinal(mensaje: string, municipioTexto: string, municipio: MunicipioOpcion | null): string | null {
  const m = mensaje.trim();
  const extra = municipioTexto.trim() && !municipio ? `Municipio: ${municipioTexto.trim()}` : '';
  const todo = [m, extra].filter(Boolean).join('\n');
  return todo ? todo.slice(0, MAX_MENSAJE_CONTACTO) : null;
}
