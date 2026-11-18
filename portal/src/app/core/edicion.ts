import { Categoria, Contacto, Excepcion, Horario } from './modelos';
import { EntradaExcepcion, EntradaHorario } from './api';

// ---------------- datos propios de cada tipo de negocio ----------------
// Son las mismas claves y límites que acepta la API (AtributosCategoria); cualquier otra la rechaza.

export type TipoCampo = 'texto' | 'numero' | 'entero' | 'hora' | 'sino' | 'opcion' | 'etiquetas' | 'multi' | 'idiomas';

export interface CampoAtributo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  ayuda?: string;
  /** Texto: largo máximo. Etiquetas: largo de cada una. */
  max?: number;
  /** Número: rango. Etiquetas y selección múltiple: cuántas como máximo. */
  min?: number;
  tope?: number;
  opciones?: { valor: string | number; texto: string }[];
}

const POR_RAIZ: Record<string, CampoAtributo[]> = {
  hospedaje: [
    { clave: 'horaEntrada', etiqueta: 'Hora de entrada', tipo: 'hora' },
    { clave: 'horaSalida', etiqueta: 'Hora de salida', tipo: 'hora' },
    { clave: 'numeroHabitaciones', etiqueta: 'Número de habitaciones', tipo: 'entero', min: 1, tope: 1000 },
    { clave: 'aceptaNinos', etiqueta: '¿Aceptan niños?', tipo: 'sino' },
    { clave: 'politicaCancelacion', etiqueta: 'Política de cancelación', tipo: 'texto', max: 500 },
  ],
  comida: [
    { clave: 'tipoCocina', etiqueta: 'Tipo de cocina', tipo: 'etiquetas', max: 40, tope: 10, ayuda: 'Hasta 10. Por ejemplo: Oaxaqueña.' },
    {
      clave: 'serviciosDeMesa',
      etiqueta: 'Servicio',
      tipo: 'multi',
      opciones: [
        { valor: 'comer_aqui', texto: 'Comer aquí' },
        { valor: 'llevar', texto: 'Para llevar' },
      ],
    },
    { clave: 'rangoPlatillo', etiqueta: 'Rango de platillo', tipo: 'texto', max: 40, ayuda: 'Por ejemplo: $90–$180' },
    { clave: 'menuUrl', etiqueta: 'Enlace al menú', tipo: 'texto', max: 500, ayuda: 'Debe empezar con https://' },
    { clave: 'platillosTipicos', etiqueta: 'Platillos típicos', tipo: 'etiquetas', max: 60, tope: 6, ayuda: 'Hasta 6.' },
  ],
  tours: [
    { clave: 'duracionHoras', etiqueta: 'Duración (horas)', tipo: 'numero', min: 0.5, tope: 240 },
    {
      clave: 'dificultad',
      etiqueta: 'Dificultad',
      tipo: 'opcion',
      opciones: [
        { valor: 'baja', texto: 'Baja' },
        { valor: 'media', texto: 'Media' },
        { valor: 'alta', texto: 'Alta' },
      ],
    },
    { clave: 'puntoEncuentro', etiqueta: 'Punto de encuentro', tipo: 'texto', max: 200 },
    { clave: 'minimoPersonas', etiqueta: 'Mínimo de personas', tipo: 'entero', min: 1, tope: 500 },
    { clave: 'idiomasGuia', etiqueta: 'Idiomas del guía', tipo: 'idiomas', tope: 6 },
  ],
  vida_nocturna: [
    {
      clave: 'edadMinima',
      etiqueta: 'Edad mínima',
      tipo: 'opcion',
      opciones: [
        { valor: 18, texto: '18 años' },
        { valor: 21, texto: '21 años' },
      ],
    },
    { clave: 'cover', etiqueta: 'Cover', tipo: 'texto', max: 60, ayuda: 'Por ejemplo: $100 los viernes' },
    {
      clave: 'musica',
      etiqueta: 'Música',
      tipo: 'multi',
      tope: 3,
      opciones: [
        { valor: 'en_vivo', texto: 'En vivo' },
        { valor: 'dj', texto: 'DJ' },
        { valor: 'ambiente', texto: 'Ambiente' },
      ],
    },
  ],
  compras: [
    {
      clave: 'enviosAlcance',
      etiqueta: 'Envíos',
      tipo: 'opcion',
      opciones: [
        { valor: 'nacional', texto: 'Nacional' },
        { valor: 'internacional', texto: 'Internacional' },
      ],
    },
  ],
};

export function camposDeRaiz(raiz: string | null): CampoAtributo[] {
  return (raiz && POR_RAIZ[raiz]) || [];
}

/** Clave de la categoría de primer nivel (hospedaje, comida, tours, vida_nocturna, compras) a la que pertenece una categoría. */
export function raizDeCategoria(arbol: Categoria[], categoriaId: string): string | null {
  for (const raiz of arbol) {
    if (raiz.id === categoriaId) return raiz.clave;
    const dentro = (c: Categoria): boolean => c.id === categoriaId || (c.hijas ?? []).some(dentro);
    if ((raiz.hijas ?? []).some(dentro)) return raiz.clave;
  }
  return null;
}

/** Quita lo vacío y lo que no corresponde al tipo de negocio, para mandar solo lo que la API acepta. */
export function limpiarAtributos(raiz: string | null, valores: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const c of camposDeRaiz(raiz)) {
    const v = valores[c.clave];
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) salida[c.clave] = v;
      continue;
    }
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) salida[c.clave] = t;
      continue;
    }
    salida[c.clave] = v;
  }
  return salida;
}

// ---------------- números y textos ----------------

/** Texto de un campo numérico a número; vacío o inválido → null. Acepta coma decimal. */
export function aNumero(t: string | number | null | undefined): number | null {
  if (t === null || t === undefined) return null;
  if (typeof t === 'number') return isFinite(t) ? t : null;
  const limpio = t.trim().replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return isFinite(n) ? n : null;
}

export const vacioANull = (t: string | null | undefined): string | null => {
  const s = (t ?? '').trim();
  return s ? s : null;
};

// ---------------- coordenadas ----------------

const LAT_MIN = 15.4, LAT_MAX = 18.9, LNG_MIN = -98.8, LNG_MAX = -93.7;

export function coordenadaValida(lat: number | null, lng: number | null): { ok: boolean; mensaje: string | null } {
  if (lat === null && lng === null) return { ok: true, mensaje: null };
  if (lat === null || lng === null) return { ok: false, mensaje: 'Escribe la latitud y la longitud, o deja las dos vacías.' };
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return { ok: false, mensaje: 'Esas coordenadas no están en Oaxaca. Revisa que la latitud y la longitud no estén al revés.' };
  }
  return { ok: true, mensaje: null };
}

export const redondear = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;

// ---------------- contactos ----------------

export const TIPOS_CONTACTO: { valor: string; texto: string; ejemplo: string }[] = [
  { valor: 'whatsapp', texto: 'WhatsApp', ejemplo: '+529511234567' },
  { valor: 'telefono', texto: 'Teléfono', ejemplo: '+529511234567' },
  { valor: 'correo', texto: 'Correo', ejemplo: 'hola@minegocio.mx' },
  { valor: 'web', texto: 'Sitio web', ejemplo: 'https://minegocio.mx' },
  { valor: 'facebook', texto: 'Facebook', ejemplo: 'https://facebook.com/minegocio' },
  { valor: 'instagram', texto: 'Instagram', ejemplo: 'https://instagram.com/minegocio' },
  { valor: 'tiktok', texto: 'TikTok', ejemplo: 'https://tiktok.com/@minegocio' },
  { valor: 'reservas_url', texto: 'Enlace de reservas', ejemplo: 'https://minegocio.mx/reservar' },
];

export const esTelefono = (tipo: string): boolean => tipo === 'whatsapp' || tipo === 'telefono';

/** La API pide «+» y lada: «951 123 4567» se vuelve «+529511234567». Si no se puede inferir, se deja como está. */
export function normalizarTelefono(valor: string): string {
  const t = valor.trim();
  const digitos = t.replace(/\D/g, '');
  if (t.startsWith('+')) return '+' + digitos;
  if (digitos.length === 10) return '+52' + digitos;
  if (digitos.length === 12 && digitos.startsWith('52')) return '+' + digitos;
  if (digitos.length === 13 && digitos.startsWith('521')) return '+52' + digitos.slice(3);
  return t;
}

/** Mensaje si el dato no es del formato que acepta la API para ese tipo; null si está bien. */
export function errorDeContacto(tipo: string, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'Escribe el dato de contacto.';
  if (esTelefono(tipo)) return /^\+[1-9][0-9]{7,14}$/.test(v) ? null : 'Escribe el número con lada, por ejemplo +529511234567.';
  if (tipo === 'correo') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'Escribe un correo válido.';
  return /^https?:\/\/\S+$/.test(v) ? null : 'Escribe la dirección completa, empezando con https://';
}

export interface FilaContacto {
  /** Id del contacto en la API; vacío si todavía no se guarda. */
  id: string | null;
  tipo: string;
  valor: string;
  esPrincipal: boolean;
}

export interface PlanContactos {
  crear: FilaContacto[];
  cambiar: FilaContacto[];
  quitar: string[];
}

/** Compara lo que hay en la API con lo que dejó la persona, para mandar solo lo que cambió. */
export function planDeContactos(actuales: Contacto[], filas: FilaContacto[]): PlanContactos {
  const idsFilas = new Set(filas.map((f) => f.id).filter((x): x is string => !!x));
  const porId = new Map(actuales.map((c) => [c.id, c]));
  return {
    crear: filas.filter((f) => !f.id),
    cambiar: filas.filter((f) => {
      const c = f.id ? porId.get(f.id) : null;
      return !!c && (c.tipo !== f.tipo || c.valor !== f.valor.trim() || c.esPrincipal !== f.esPrincipal);
    }),
    quitar: actuales.filter((c) => !idsFilas.has(c.id)).map((c) => c.id),
  };
}

// ---------------- horarios ----------------

/** Lunes primero, que es como se lee; la API usa 0 = domingo. */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const nombreDia = (d: number): string => NOMBRES[d] ?? '';

export interface Franja {
  abre: string;
  cierra: string;
}

export interface DiaEditable {
  dia: number;
  cerrado: boolean;
  franjas: Franja[];
}

export const MAX_FRANJAS = 3;
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const horaValida = (h: string): boolean => HORA.test(h);

/** La API manda «08:00:00» o «08:00»; el campo de hora usa «08:00». */
export const hhmm = (h: string | null | undefined): string => (h ?? '').slice(0, 5);

/** Una fila de la API por franja → siete días. Un día sin filas queda sin horario (ni abierto ni cerrado). */
export function diasDesdeHorarios(horarios: Horario[]): DiaEditable[] {
  return ORDEN_DIAS.map((dia) => {
    const filas = horarios.filter((h) => h.diaSemana === dia);
    const cerrado = filas.some((h) => h.cerrado);
    return {
      dia,
      cerrado,
      franjas: cerrado ? [] : filas.map((h) => ({ abre: hhmm(h.abre), cierra: hhmm(h.cierra) })),
    };
  });
}

/** Siete días → las filas que espera la API. Los días sin franjas ni «cerrado» no se mandan. */
export function horariosParaApi(dias: DiaEditable[]): EntradaHorario[] {
  const salida: EntradaHorario[] = [];
  for (const d of dias) {
    if (d.cerrado) salida.push({ diaSemana: d.dia, abre: null, cierra: null, cerrado: true });
    else for (const f of d.franjas) salida.push({ diaSemana: d.dia, abre: f.abre, cierra: f.cierra, cerrado: false });
  }
  return salida;
}

/** Primer problema que se ve antes de mandar; null si todo está bien. */
export function errorDeHorarios(dias: DiaEditable[]): string | null {
  for (const d of dias) {
    if (d.cerrado) continue;
    if (d.franjas.length > MAX_FRANJAS) return `${nombreDia(d.dia)}: máximo ${MAX_FRANJAS} horarios por día.`;
    for (const f of d.franjas) {
      if (!horaValida(f.abre) || !horaValida(f.cierra)) return `${nombreDia(d.dia)}: indica la hora de apertura y la de cierre.`;
      if (f.abre === f.cierra) return `${nombreDia(d.dia)}: la apertura y el cierre no pueden ser la misma hora.`;
    }
  }
  return null;
}

/** Copia el horario de un día a todos los demás (el domingo incluido). */
export function copiarATodos(dias: DiaEditable[], origen: number): DiaEditable[] {
  const base = dias.find((d) => d.dia === origen);
  if (!base) return dias;
  return dias.map((d) => ({ dia: d.dia, cerrado: base.cerrado, franjas: base.franjas.map((f) => ({ ...f })) }));
}

// ---------------- fechas especiales ----------------

export interface ExcepcionEditable {
  fecha: string;
  cerrado: boolean;
  abre: string;
  cierra: string;
  nota: string;
}

export const excepcionesDesdeApi = (l: Excepcion[]): ExcepcionEditable[] =>
  l.map((e) => ({ fecha: e.fecha, cerrado: e.cerrado, abre: hhmm(e.abre), cierra: hhmm(e.cierra), nota: e.nota ?? '' }));

export function excepcionesParaApi(l: ExcepcionEditable[]): EntradaExcepcion[] {
  return l.map((e) => ({
    fecha: e.fecha,
    cerrado: e.cerrado,
    abre: e.cerrado ? null : e.abre,
    cierra: e.cerrado ? null : e.cierra,
    nota: vacioANull(e.nota),
  }));
}

/** hoyIso = «2026-11-13». La API solo acepta fechas de hoy en adelante y una por fecha. */
export function errorDeExcepciones(l: ExcepcionEditable[], hoyIso: string): string | null {
  const vistas = new Set<string>();
  for (const e of l) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) return 'Elige la fecha de cada día especial.';
    if (e.fecha < hoyIso) return 'Las fechas especiales deben ser de hoy en adelante.';
    if (vistas.has(e.fecha)) return 'Hay dos días especiales con la misma fecha.';
    vistas.add(e.fecha);
    if (!e.cerrado && (!horaValida(e.abre) || !horaValida(e.cierra))) return `El ${e.fecha}: indica el horario o márcalo como cerrado.`;
  }
  return null;
}

export const hoyIso = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------- servicios ----------------

export function agruparPor<T extends { grupo: string }>(lista: T[]): { grupo: string; titulo: string; items: T[] }[] {
  const mapa = new Map<string, T[]>();
  for (const x of lista) mapa.set(x.grupo, [...(mapa.get(x.grupo) ?? []), x]);
  return [...mapa.entries()].map(([grupo, items]) => ({ grupo, titulo: tituloDeGrupo(grupo), items }));
}

export function tituloDeGrupo(grupo: string): string {
  const t = grupo.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
