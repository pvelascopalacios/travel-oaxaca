import { aNumero, vacioANull } from './edicion';
import { EstadoOferta, Oferta, OfertaEntrada, OfertaTraduccion, PlanNegocio, TipoOferta } from './modelos';

/** Qué tipos de opción admite cada categoría raíz (igual que la API: otra combinación da error). */
const TIPOS_POR_RAIZ: Record<string, TipoOferta[]> = {
  hospedaje: ['habitacion'],
  comida: ['platillo'],
  vida_nocturna: ['platillo'],
  tours: ['tour', 'experiencia'],
  compras: ['producto'],
};

export const MAX_OFERTAS = 100;

export function tiposDeRaiz(raiz: string | null): TipoOferta[] {
  return (raiz && TIPOS_POR_RAIZ[raiz]) || [];
}

export function tituloLista(raiz: string | null): string {
  switch (raiz) {
    case 'hospedaje': return 'Habitaciones';
    case 'tours': return 'Tours y experiencias';
    case 'compras': return 'Productos';
    default: return 'Menú';
  }
}

const NOMBRE_TIPO: Record<string, { uno: string; nuevo: string }> = {
  habitacion: { uno: 'Habitación', nuevo: 'habitación' },
  tour: { uno: 'Tour', nuevo: 'tour' },
  experiencia: { uno: 'Experiencia', nuevo: 'experiencia' },
  platillo: { uno: 'Platillo', nuevo: 'platillo' },
  producto: { uno: 'Producto', nuevo: 'producto' },
};
export const nombreTipo = (t: string): string => NOMBRE_TIPO[t]?.uno ?? t;
/** «Nuevo» o «Nueva» según el género de la palabra. */
export const articuloNuevo = (t: string): string => (t === 'habitacion' || t === 'experiencia' ? 'Nueva' : 'Nuevo');
export const nombreTipoNuevo = (t: string): string => NOMBRE_TIPO[t]?.nuevo ?? t;

export const SECCIONES_MENU = [
  { clave: 'entradas', texto: 'Entradas' },
  { clave: 'platos_fuertes', texto: 'Platos fuertes' },
  { clave: 'bebidas', texto: 'Bebidas' },
  { clave: 'postres', texto: 'Postres' },
  { clave: 'otros', texto: 'Otros' },
] as const;

export const MARCAS = [
  { clave: 'vegetariano', texto: 'Vegetariano' },
  { clave: 'picante', texto: 'Picante' },
  { clave: 'sin_gluten', texto: 'Sin gluten' },
] as const;
export const marcaTexto = (c: string): string => MARCAS.find((m) => m.clave === c)?.texto ?? c;

export const UNIDADES: Record<string, string> = { por_noche: 'por noche', por_persona: 'por persona', por_grupo: 'por grupo', por_pieza: 'por pieza' };

export function unidadesDeTipo(tipo: string): string[] {
  switch (tipo) {
    case 'habitacion': return ['por_noche', 'por_persona'];
    case 'tour':
    case 'experiencia': return ['por_persona', 'por_grupo'];
    case 'producto': return ['por_pieza'];
    default: return ['por_persona', 'por_pieza', 'por_grupo'];
  }
}

export const IDIOMAS_OPCION = [{ codigo: 'es', texto: 'Español' }, { codigo: 'en', texto: 'English' }] as const;

// ---------------- formulario ----------------

export interface TextoOpcion { nombre: string; descripcion: string; incluye: string; noIncluye: string }
export interface FormOferta {
  tipo: string;
  textos: Record<string, TextoOpcion>;
  precio: string;
  unidad: string;
  horas: string;
  minutos: string;
  capacidad: string;
  seccion: string;
  etiquetas: string[];
  orden: number;
}

const TEXTO_VACIO = (): TextoOpcion => ({ nombre: '', descripcion: '', incluye: '', noIncluye: '' });

export function formVacio(tipo: string, orden = 0): FormOferta {
  return {
    tipo,
    textos: { es: TEXTO_VACIO(), en: TEXTO_VACIO() },
    precio: '',
    unidad: unidadesDeTipo(tipo)[0],
    horas: '',
    minutos: '',
    capacidad: '',
    seccion: tipo === 'platillo' ? 'platos_fuertes' : '',
    etiquetas: [],
    orden,
  };
}

export function formDeOferta(o: Oferta): FormOferta {
  const f = formVacio(o.tipo, o.orden);
  for (const [c, t] of Object.entries(o.traducciones ?? {})) {
    f.textos[c] = { nombre: t.nombre ?? '', descripcion: t.descripcion ?? '', incluye: t.incluye ?? '', noIncluye: t.noIncluye ?? '' };
  }
  f.precio = o.precioDesde === null || o.precioDesde === undefined ? '' : String(o.precioDesde);
  f.unidad = o.unidadPrecio ?? '';
  const d = minutosAHorasMin(o.duracionMin);
  f.horas = d ? String(d.horas) : '';
  f.minutos = d && d.minutos ? String(d.minutos) : '';
  f.capacidad = o.capacidad ? String(o.capacidad) : '';
  f.seccion = o.seccion ?? '';
  f.etiquetas = [...(o.etiquetas ?? [])];
  return f;
}

// ---------------- duración (la API la guarda en minutos) ----------------

export function duracionAMinutos(horas: string, minutos: string): number | null {
  const h = aNumero(horas);
  const m = aNumero(minutos);
  if (h === null && m === null) return null;
  return Math.round((h ?? 0) * 60 + (m ?? 0));
}

export function minutosAHorasMin(min: number | null | undefined): { horas: number; minutos: number } | null {
  if (!min || min <= 0) return null;
  return { horas: Math.floor(min / 60), minutos: min % 60 };
}

export function duracionTexto(min: number | null | undefined): string {
  const d = minutosAHorasMin(min);
  if (!d) return '';
  if (!d.minutos) return `${d.horas} h`;
  if (!d.horas) return `${d.minutos} min`;
  return `${d.horas} h ${d.minutos} min`;
}

// ---------------- validar y armar el cuerpo ----------------

const TIPOS_CON_DURACION = ['tour', 'experiencia'];
const TIPOS_CON_INCLUYE = ['habitacion', 'tour', 'experiencia'];
export const usaDuracion = (tipo: string): boolean => TIPOS_CON_DURACION.includes(tipo);
export const usaCapacidad = (tipo: string): boolean => ['habitacion', 'tour', 'experiencia'].includes(tipo);
export const usaIncluye = (tipo: string): boolean => TIPOS_CON_INCLUYE.includes(tipo);
export const usaMenu = (tipo: string): boolean => tipo === 'platillo';

/** Errores por campo, con los mismos nombres que usa la API (`traducciones.es.nombre`, `precioDesde`…). */
export function errorDeOferta(f: FormOferta): Record<string, string> {
  const e: Record<string, string> = {};
  const es = f.textos['es'];
  if (!es?.nombre.trim()) e['traducciones.es.nombre'] = 'El nombre en español es obligatorio.';
  for (const [c, t] of Object.entries(f.textos)) {
    if (t.nombre.length > 150) e[`traducciones.${c}.nombre`] = 'Nombre demasiado largo.';
    if (t.descripcion.length > 4000) e[`traducciones.${c}.descripcion`] = 'Descripción demasiado larga.';
    if (t.incluye.length > 2000) e[`traducciones.${c}.incluye`] = 'Texto demasiado largo.';
    if (t.noIncluye.length > 2000) e[`traducciones.${c}.noIncluye`] = 'Texto demasiado largo.';
  }
  const en = f.textos['en'];
  if (en && !en.nombre.trim() && (en.descripcion.trim() || en.incluye.trim() || en.noIncluye.trim())) {
    e['traducciones.en.nombre'] = 'Si escribes en inglés, agrega también el nombre.';
  }
  if (f.precio.trim()) {
    const p = aNumero(f.precio);
    if (p === null || p < 0) e['precioDesde'] = 'Escribe un precio válido.';
    else if (p > 99999999) e['precioDesde'] = 'Precio demasiado alto.';
  }
  if (usaCapacidad(f.tipo) && f.capacidad.trim()) {
    const c = aNumero(f.capacidad);
    if (c === null || c < 1 || !Number.isInteger(c)) e['capacidad'] = 'La capacidad debe ser un número entero positivo.';
  }
  if (usaDuracion(f.tipo) && (f.horas.trim() || f.minutos.trim())) {
    const h = aNumero(f.horas || '0');
    const m = aNumero(f.minutos || '0');
    if (h === null || m === null || h < 0 || m < 0 || m > 59 || !Number.isInteger(h) || !Number.isInteger(m)) e['duracionMin'] = 'Escribe horas enteras y minutos de 0 a 59.';
    else if ((duracionAMinutos(f.horas, f.minutos) ?? 0) < 1) e['duracionMin'] = 'La duración debe ser positiva.';
  }
  if (f.etiquetas.length > 3) e['etiquetas'] = 'Máximo 3 marcas.';
  return e;
}

/** Cuerpo para la API: solo lo que corresponde al tipo (la API rechaza sección y marcas fuera de los platillos). */
export function ofertaParaApi(f: FormOferta): OfertaEntrada {
  const traducciones: Record<string, OfertaTraduccion> = {};
  for (const [c, t] of Object.entries(f.textos)) {
    const nombre = t.nombre.trim();
    if (!nombre) continue; // el español ya se validó; un idioma sin nombre no se manda
    traducciones[c] = {
      nombre,
      descripcion: vacioANull(t.descripcion),
      incluye: usaIncluye(f.tipo) ? vacioANull(t.incluye) : null,
      noIncluye: usaIncluye(f.tipo) ? vacioANull(t.noIncluye) : null,
    };
  }
  return {
    tipo: f.tipo,
    precioDesde: aNumero(f.precio),
    unidadPrecio: f.unidad || null,
    duracionMin: usaDuracion(f.tipo) ? duracionAMinutos(f.horas, f.minutos) : null,
    capacidad: usaCapacidad(f.tipo) ? aNumero(f.capacidad) : null,
    orden: f.orden,
    seccion: usaMenu(f.tipo) ? f.seccion || 'otros' : null,
    etiquetas: usaMenu(f.tipo) ? f.etiquetas : [],
    traducciones,
  };
}

/** El mismo contenido de una opción ya guardada, con otro orden (para reordenar sin tocar lo demás). */
export function entradaDeOferta(o: Oferta, orden: number): OfertaEntrada {
  return {
    tipo: o.tipo,
    precioDesde: o.precioDesde,
    unidadPrecio: o.unidadPrecio,
    duracionMin: o.duracionMin,
    capacidad: o.capacidad,
    orden,
    seccion: o.seccion,
    etiquetas: o.etiquetas ?? [],
    traducciones: o.traducciones ?? {},
  };
}

// ---------------- lista ----------------

export function nombreDe(o: Oferta): string {
  return o.traducciones?.['es']?.nombre ?? Object.values(o.traducciones ?? {})[0]?.nombre ?? '(sin nombre)';
}

export function ordenarOfertas(lista: Oferta[]): Oferta[] {
  return [...lista].sort((a, b) => a.orden - b.orden || nombreDe(a).localeCompare(nombreDe(b), 'es'));
}

export interface GrupoOpciones { clave: string; texto: string; ofertas: Oferta[] }

/** Platillos por sección del menú; el resto de los tipos van en un solo grupo. Las archivadas se separan. */
export function agrupar(lista: Oferta[], raiz: string | null): { grupos: GrupoOpciones[]; archivadas: Oferta[] } {
  const activas = ordenarOfertas(lista.filter((o) => o.estado !== 'archivada'));
  const archivadas = ordenarOfertas(lista.filter((o) => o.estado === 'archivada'));
  if (!tiposDeRaiz(raiz).includes('platillo')) {
    return { grupos: activas.length ? [{ clave: 'todas', texto: '', ofertas: activas }] : [], archivadas };
  }
  const grupos = SECCIONES_MENU.map((s) => ({ clave: s.clave as string, texto: s.texto as string, ofertas: activas.filter((o) => (o.seccion ?? 'otros') === s.clave) })).filter((g) => g.ofertas.length);
  return { grupos, archivadas };
}

/** Cambios de `orden` para mover una opción dentro de su grupo: solo las que cambian de lugar. */
export function moverOferta(grupo: Oferta[], ofertaId: string, d: -1 | 1): { id: string; orden: number }[] {
  const i = grupo.findIndex((o) => o.id === ofertaId);
  const j = i + d;
  if (i < 0 || j < 0 || j >= grupo.length) return [];
  const nueva = [...grupo];
  [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
  // Se renumera 0..n-1 para que no queden órdenes repetidos que dejen el reacomodo ambiguo.
  return nueva.map((o, k) => ({ id: o.id, orden: k })).filter((c) => grupo.find((o) => o.id === c.id)?.orden !== c.orden);
}

export function accionDeEstado(estado: string): { destino: EstadoOferta; texto: string } | null {
  switch (estado) {
    case 'borrador': return { destino: 'publicada', texto: 'Publicar' };
    case 'publicada': return { destino: 'pausada', texto: 'Pausar' };
    case 'pausada': return { destino: 'publicada', texto: 'Reanudar' };
    case 'archivada': return { destino: 'borrador', texto: 'Restaurar' };
    default: return null;
  }
}

export function estadoOfertaInfo(e: string): { texto: string; clase: string } {
  switch (e) {
    case 'publicada': return { texto: 'Publicada', clase: 'publicada' };
    case 'borrador': return { texto: 'Borrador', clase: 'borrador' };
    case 'pausada': return { texto: 'Pausada', clase: 'pausada' };
    case 'archivada': return { texto: 'Archivada', clase: 'archivada' };
    default: return { texto: e, clase: 'borrador' };
  }
}

export function precioTexto(o: Oferta): { precio: string; unidad: string } | null {
  if (o.precioDesde === null || o.precioDesde === undefined) return null;
  const n = Number(o.precioDesde);
  const precio = '$' + n.toLocaleString('es-MX', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return { precio, unidad: o.unidadPrecio ? UNIDADES[o.unidadPrecio] ?? '' : '' };
}

export interface CupoOfertas {
  /** El plan no incluye opciones. */
  sinPlan: boolean;
  limite: number;
  usadas: number;
  lleno: boolean;
}

/** Las archivadas no cuentan para el cupo (misma regla que la API). Sin datos del plan solo aplica el tope de 100. */
export function cupoOfertas(plan: PlanNegocio | null, ofertas: Oferta[]): CupoOfertas {
  const usadas = ofertas.filter((o) => o.estado !== 'archivada').length;
  const limite = Math.min(MAX_OFERTAS, plan?.plan.limiteOfertas ?? MAX_OFERTAS);
  return { sinPlan: plan !== null && plan.plan.limiteOfertas === 0, limite, usadas, lleno: usadas >= limite };
}
