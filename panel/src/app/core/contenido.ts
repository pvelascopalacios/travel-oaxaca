import { aNumero, vacioANull } from './cobros';
import {
  BloqueAdmin, BloqueEntrada, CategoriaCatalogo, DatosEvento, DatosLugar, EventoAdmin, EventoEntrada, LugarAdmin, LugarEntrada, Parada, RutaAdmin, RutaEntrada, TextoBloque,
} from './modelos';

// ---------------- comunes ----------------

export interface Chip {
  texto: string;
  clase: 'ok' | 'cambio' | 'gris' | 'mal';
}

/** Estados de lugares, eventos, rutas y bloques de inicio (femenino y masculino). */
export function estadoContenido(e: string): Chip {
  switch (e) {
    case 'publicado':
    case 'publicada': return { texto: e === 'publicada' ? 'Publicada' : 'Publicado', clase: 'ok' };
    case 'borrador': return { texto: 'Borrador', clase: 'cambio' };
    case 'cancelado': return { texto: 'Cancelado', clase: 'mal' };
    case 'archivado':
    case 'archivada': return { texto: e === 'archivada' ? 'Archivada' : 'Archivado', clase: 'gris' };
    default: return { texto: e, clase: 'gris' };
  }
}

export const ESTADOS_GENERALES = [
  { clave: 'borrador', texto: 'Borrador' },
  { clave: 'publicado', texto: 'Publicado' },
  { clave: 'archivado', texto: 'Archivado' },
];
export const ESTADOS_RUTA = [
  { clave: 'borrador', texto: 'Borrador' },
  { clave: 'publicada', texto: 'Publicada' },
  { clave: 'archivada', texto: 'Archivada' },
];
export const ESTADOS_EVENTO = [...ESTADOS_GENERALES.slice(0, 2), { clave: 'cancelado', texto: 'Cancelado' }, ESTADOS_GENERALES[2]];

export const LATITUD = { min: 15.4, max: 18.9 };
export const LONGITUD = { min: -98.8, max: -93.7 };

/** Mismo criterio que la API: las dos juntas y dentro de Oaxaca. Devuelve el mensaje o null. */
export function errorDeUbicacion(lat: number | null, lng: number | null): string | null {
  if ((lat === null) !== (lng === null)) return 'Marca el punto completo (latitud y longitud).';
  if (lat !== null && lng !== null && (lat < LATITUD.min || lat > LATITUD.max || lng < LONGITUD.min || lng > LONGITUD.max)) {
    return 'Esas coordenadas no están en Oaxaca. Revisa que la latitud y la longitud no estén al revés.';
  }
  return null;
}

export const largoMax = (v: string | null | undefined, max: number, mensaje?: string): string | null =>
  (v ?? '').length > max ? mensaje ?? `Máximo ${max} caracteres.` : null;

/** Idiomas con algo escrito. El español siempre cuenta porque es obligatorio. */
export function idiomasConTexto<T extends object>(textos: Record<string, T>, clave: (t: T) => string): string[] {
  return Object.entries(textos).filter(([i, t]) => i === 'es' || clave(t).trim() !== '').map(([i]) => i);
}

// ---------------- inicio: bloques ----------------

export const TIPOS_BLOQUE = [
  { clave: 'destacado', texto: 'Destacado', plural: 'Destacados', ayuda: 'Etiqueta, título, texto, botón y página' },
  { clave: 'pueblo', texto: 'Pueblo', plural: 'Pueblos', ayuda: 'Región, comunidades y saludo en lengua' },
  { clave: 'historia', texto: 'Historia', plural: 'Historias', ayuda: 'Persona, lugar y permiso' },
  { clave: 'reel', texto: 'Reel', plural: 'Reels', ayuda: 'Enlace de Facebook' },
];
export const tipoBloqueTexto = (t: string): string => TIPOS_BLOQUE.find((x) => x.clave === t)?.texto ?? t;

/** Cómo se llama cada campo de texto según el tipo (la API reutiliza los mismos). */
export function etiquetasBloque(tipo: string): { etiqueta: string; titulo: string; texto: string; boton: string | null } {
  switch (tipo) {
    case 'pueblo': return { etiqueta: 'Etiqueta', titulo: 'Nombre del pueblo', texto: 'Región', boton: null };
    case 'historia': return { etiqueta: 'Etiqueta', titulo: 'Frase de la historia', texto: 'Texto', boton: null };
    case 'reel': return { etiqueta: 'Etiqueta', titulo: 'Título', texto: 'Texto', boton: null };
    default: return { etiqueta: 'Etiqueta', titulo: 'Título', texto: 'Texto', boton: 'Texto del botón' };
  }
}

export interface FormBloque {
  tipo: string;
  orden: string;
  estado: string;
  publicarDesde: string;
  publicarHasta: string;
  medioId: string | null;
  fotoUrl: string | null;
  credito: string;
  ruta: string;
  enlace: string;
  comunidades: string;
  saludo: string;
  saludoIdioma: string;
  saludoVerificadoPor: string;
  persona: string;
  lugar: string;
  negocioId: string | null;
  negocioNombre: string;
  permisoConfirmado: boolean;
  textos: Record<string, { etiqueta: string; titulo: string; texto: string; boton: string }>;
}

export const textoBloqueVacio = () => ({ etiqueta: '', titulo: '', texto: '', boton: '' });

export const formBloqueVacio = (tipo = 'destacado'): FormBloque => ({
  tipo, orden: '0', estado: 'borrador', publicarDesde: '', publicarHasta: '', medioId: null, fotoUrl: null, credito: '', ruta: '', enlace: '', comunidades: '',
  saludo: '', saludoIdioma: '', saludoVerificadoPor: '', persona: '', lugar: '', negocioId: null, negocioNombre: '', permisoConfirmado: false,
  textos: { es: textoBloqueVacio() },
});

export function formDeBloque(b: BloqueAdmin): FormBloque {
  const textos: FormBloque['textos'] = {};
  for (const [i, t] of Object.entries(b.traducciones ?? {})) {
    textos[i] = { etiqueta: t.etiqueta ?? '', titulo: t.titulo ?? '', texto: t.texto ?? '', boton: t.boton ?? '' };
  }
  if (!textos['es']) textos['es'] = textoBloqueVacio();
  return {
    tipo: b.tipo, orden: String(b.orden ?? 0), estado: b.estado, publicarDesde: b.publicarDesde ?? '', publicarHasta: b.publicarHasta ?? '', medioId: b.medioId, fotoUrl: b.fotoUrl,
    credito: b.credito ?? '', ruta: b.ruta ?? '', enlace: b.enlace ?? '', comunidades: b.comunidades === null || b.comunidades === undefined ? '' : String(b.comunidades),
    saludo: b.saludo ?? '', saludoIdioma: b.saludoIdioma ?? '', saludoVerificadoPor: b.saludoVerificadoPor ?? '', persona: b.persona ?? '', lugar: b.lugar ?? '',
    negocioId: b.negocioId, negocioNombre: '', permisoConfirmado: b.permisoConfirmado, textos,
  };
}

const RUTA_SITIO = /^\/[A-Za-z0-9/_?=&.%-]*$/;
const FACEBOOK = /^https:\/\/(((www|m)\.)?facebook\.com|fb\.watch)\/.*$/;

export interface Falta {
  campo: string;
  texto: string;
  ok: boolean;
}

/** Lo que exige la API para publicar un bloque, punto por punto (para mostrarlo antes de guardar). */
export function faltasParaPublicar(f: FormBloque): Falta[] {
  const es = f.textos['es'] ?? textoBloqueVacio();
  const l: Falta[] = [
    { campo: 'medioId', texto: 'Tiene foto', ok: !!f.medioId },
    { campo: 'titulo', texto: 'Título en español', ok: es.titulo.trim() !== '' },
  ];
  if (f.tipo === 'destacado') {
    l.push({ campo: 'ruta', texto: 'Indica a qué página lleva', ok: f.ruta.trim() !== '' });
    l.push({ campo: 'boton', texto: 'Texto del botón en español', ok: es.boton.trim() !== '' });
  } else if (f.tipo === 'reel') {
    l.push({ campo: 'enlace', texto: 'Enlace del Reel en Facebook', ok: f.enlace.trim() !== '' });
  } else if (f.tipo === 'historia') {
    l.push({ campo: 'persona', texto: 'Quién es la persona de la historia', ok: f.persona.trim() !== '' });
    l.push({ campo: 'permisoConfirmado', texto: 'Permiso de la persona confirmado', ok: f.permisoConfirmado });
  }
  return l;
}

export function errorDeBloque(f: FormBloque): Record<string, string> {
  const e: Record<string, string> = {};
  const es = f.textos['es'];
  if (!es || es.titulo.trim() === '') e['titulo'] = 'Escribe el título en español.';
  for (const [i, t] of Object.entries(f.textos)) {
    const m = largoMax(t.etiqueta, 60) ?? largoMax(t.titulo, 160) ?? largoMax(t.texto, 400) ?? largoMax(t.boton, 40);
    if (m) e['texto-' + i] = m;
    if (i !== 'es' && (t.etiqueta || t.texto || t.boton) && t.titulo.trim() === '') e['titulo-' + i] = 'Si escribes este idioma, falta el título.';
  }
  const orden = aNumero(f.orden);
  if (f.orden.trim() && (orden === null || !Number.isInteger(orden) || orden < 0 || orden > 999)) e['orden'] = 'Un número entero de 0 a 999.';
  if (f.publicarDesde && f.publicarHasta && f.publicarHasta < f.publicarDesde) e['publicarHasta'] = 'Elige una fecha igual o posterior.';
  const cred = largoMax(f.credito, 120);
  if (cred) e['credito'] = cred;
  if (f.tipo === 'destacado' && f.ruta.trim()) {
    if (f.ruta.length > 200) e['ruta'] = 'Máximo 200 caracteres.';
    else if (!RUTA_SITIO.test(f.ruta.trim()) || f.ruta.trim().startsWith('//')) e['ruta'] = 'Empieza con / y no lleva dominio. Ej. /lugar/monte-alban';
  }
  if (f.tipo === 'reel' && f.enlace.trim()) {
    if (f.enlace.length > 300) e['enlace'] = 'Máximo 300 caracteres.';
    else if (!FACEBOOK.test(f.enlace.trim())) e['enlace'] = 'Debe ser un enlace de Facebook (https://www.facebook.com/… o https://fb.watch/…).';
  }
  if (f.tipo === 'pueblo') {
    if (f.comunidades.trim()) {
      const c = aNumero(f.comunidades);
      if (c === null || !Number.isInteger(c) || c < 0) e['comunidades'] = 'Un número entero, 0 o más.';
    }
    if (f.saludo.trim()) {
      const s = largoMax(f.saludo, 120);
      if (s) e['saludo'] = s;
      if (!f.saludoIdioma) e['saludoIdioma'] = 'Elige la lengua del saludo.';
      if (!f.saludoVerificadoPor.trim()) e['saludoVerificadoPor'] = 'Indica quién lo verificó.';
      else if (f.saludoVerificadoPor.length > 200) e['saludoVerificadoPor'] = 'Máximo 200 caracteres.';
    }
  }
  if (f.tipo === 'historia') {
    const p = largoMax(f.persona, 120);
    if (p) e['persona'] = p;
    const lu = largoMax(f.lugar, 120);
    if (lu) e['lugar'] = lu;
  }
  if (f.estado === 'publicado') {
    for (const x of faltasParaPublicar(f)) if (!x.ok && !e[x.campo]) e[x.campo] = 'Falta para publicar.';
  }
  return e;
}

export function bloqueParaApi(f: FormBloque): BloqueEntrada {
  const traducciones: Record<string, TextoBloque> = {};
  for (const [i, t] of Object.entries(f.textos)) {
    if (i !== 'es' && t.titulo.trim() === '') continue;
    traducciones[i] = { etiqueta: vacioANull(t.etiqueta), titulo: t.titulo.trim(), texto: vacioANull(t.texto), boton: vacioANull(t.boton) };
  }
  const saludo = f.tipo === 'pueblo' ? vacioANull(f.saludo) : null;
  return {
    tipo: f.tipo,
    orden: f.orden.trim() ? aNumero(f.orden) : 0,
    estado: f.estado,
    publicarDesde: f.publicarDesde || null,
    publicarHasta: f.publicarHasta || null,
    medioId: f.medioId,
    credito: vacioANull(f.credito),
    ruta: f.tipo === 'destacado' ? vacioANull(f.ruta) : null,
    enlace: f.tipo === 'reel' ? vacioANull(f.enlace) : null,
    comunidades: f.tipo === 'pueblo' && f.comunidades.trim() ? aNumero(f.comunidades) : null,
    saludo,
    saludoIdioma: saludo ? vacioANull(f.saludoIdioma) : null,
    saludoVerificadoPor: saludo ? vacioANull(f.saludoVerificadoPor) : null,
    persona: f.tipo === 'historia' ? vacioANull(f.persona) : null,
    lugar: f.tipo === 'historia' ? vacioANull(f.lugar) : null,
    negocioId: f.tipo === 'historia' ? f.negocioId : null,
    permisoConfirmado: f.tipo === 'historia' && f.permisoConfirmado,
    traducciones,
  };
}

// ---------------- lugares ----------------

export const TIPOS_LUGAR = [
  { clave: 'arqueologico', texto: 'Arqueológico' }, { clave: 'natural', texto: 'Natural' }, { clave: 'cultural', texto: 'Cultural' }, { clave: 'playa', texto: 'Playa' },
  { clave: 'mercado', texto: 'Mercado' }, { clave: 'templo', texto: 'Templo' }, { clave: 'otro', texto: 'Otro' },
];
export const tipoLugarTexto = (t: string): string => TIPOS_LUGAR.find((x) => x.clave === t)?.texto ?? t;
export const DIAS_SEMANA = [
  { n: 0, texto: 'Dom' }, { n: 1, texto: 'Lun' }, { n: 2, texto: 'Mar' }, { n: 3, texto: 'Mié' }, { n: 4, texto: 'Jue' }, { n: 5, texto: 'Vie' }, { n: 6, texto: 'Sáb' },
];

export interface TextoLugarForm {
  nombre: string;
  resumen: string;
  historia: string;
  recomendaciones: string;
  mejorEpoca: string;
  comoLlegar: string;
}
export const textoLugarVacio = (): TextoLugarForm => ({ nombre: '', resumen: '', historia: '', recomendaciones: '', mejorEpoca: '', comoLlegar: '' });

export interface FormLugar {
  tipo: string;
  estado: string;
  municipioId: string | null;
  padreId: string | null;
  padreNombre: string;
  latitud: number | null;
  longitud: number | null;
  destacado: boolean;
  entrada: string;
  costoNacional: string;
  costoExtranjero: string;
  dias: number[];
  horarioTexto: string;
  accesible: string;
  dificultad: string;
  textos: Record<string, TextoLugarForm>;
}

export const formLugarVacio = (): FormLugar => ({
  tipo: 'cultural', estado: 'borrador', municipioId: null, padreId: null, padreNombre: '', latitud: null, longitud: null, destacado: false, entrada: '', costoNacional: '',
  costoExtranjero: '', dias: [], horarioTexto: '', accesible: '', dificultad: '', textos: { es: textoLugarVacio() },
});

export function formDeLugar(l: LugarAdmin): FormLugar {
  const d: DatosLugar = l.datos ?? {};
  const textos: Record<string, TextoLugarForm> = {};
  for (const [i, t] of Object.entries(l.traducciones ?? {})) {
    textos[i] = { nombre: t.nombre ?? '', resumen: t.resumen ?? '', historia: t.historia ?? '', recomendaciones: t.recomendaciones ?? '', mejorEpoca: t.mejorEpoca ?? '', comoLlegar: t.comoLlegar ?? '' };
  }
  if (!textos['es']) textos['es'] = textoLugarVacio();
  return {
    tipo: l.tipo, estado: l.estado, municipioId: l.municipioId, padreId: l.padreId, padreNombre: '', latitud: l.latitud, longitud: l.longitud, destacado: l.destacado,
    entrada: d.entrada ?? '', costoNacional: d.costoNacional === undefined ? '' : String(d.costoNacional), costoExtranjero: d.costoExtranjero === undefined ? '' : String(d.costoExtranjero),
    dias: [...(d.diasAbierto ?? [])].sort((a, b) => a - b), horarioTexto: d.horarioTexto ?? '', accesible: d.accesible === undefined ? '' : d.accesible ? 'si' : 'no',
    dificultad: d.dificultad ?? '', textos,
  };
}

export function errorDeLugar(f: FormLugar): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.textos['es'] || f.textos['es'].nombre.trim() === '') e['nombre'] = 'Escribe el nombre en español.';
  for (const [i, t] of Object.entries(f.textos)) {
    const m = largoMax(t.nombre, 200, 'El nombre admite hasta 200 caracteres.') ?? largoMax(t.resumen, 500, 'El resumen admite hasta 500 caracteres.') ?? largoMax(t.historia, 8000, 'La historia admite hasta 8000 caracteres.')
      ?? largoMax(t.recomendaciones, 4000, 'Las recomendaciones admiten hasta 4000 caracteres.') ?? largoMax(t.mejorEpoca, 300, 'La mejor época admite hasta 300 caracteres.') ?? largoMax(t.comoLlegar, 2000, 'Cómo llegar admite hasta 2000 caracteres.');
    if (m) e['texto-' + i] = m;
    if (i !== 'es' && Object.values(t).some((v) => v.trim()) && t.nombre.trim() === '') e['nombre-' + i] = 'Si escribes este idioma, falta el nombre.';
  }
  const u = errorDeUbicacion(f.latitud, f.longitud);
  if (u) e['latitud'] = u;
  if (f.estado === 'publicado' && (f.latitud === null || !f.municipioId)) e['estado'] = 'Para publicar indica el municipio y la ubicación en el mapa.';
  if (f.entrada === 'con_costo') {
    for (const [k, v] of [['costoNacional', f.costoNacional], ['costoExtranjero', f.costoExtranjero]] as const) {
      if (!v.trim()) continue;
      const n = aNumero(v);
      if (n === null || n < 0 || n > 100000) e[k] = 'Un número entre 0 y 100000.';
    }
  }
  if (f.horarioTexto.length > 200) e['horarioTexto'] = 'Máximo 200 caracteres.';
  return e;
}

export function lugarParaApi(f: FormLugar): LugarEntrada {
  const datos: DatosLugar = {};
  if (f.entrada) datos.entrada = f.entrada;
  if (f.entrada === 'con_costo') {
    if (f.costoNacional.trim()) datos.costoNacional = aNumero(f.costoNacional) ?? undefined;
    if (f.costoExtranjero.trim()) datos.costoExtranjero = aNumero(f.costoExtranjero) ?? undefined;
  }
  if (f.dias.length) datos.diasAbierto = [...new Set(f.dias)].sort((a, b) => a - b);
  if (f.horarioTexto.trim()) datos.horarioTexto = f.horarioTexto.trim();
  if (f.accesible) datos.accesible = f.accesible === 'si';
  if (f.dificultad) datos.dificultad = f.dificultad;
  const traducciones: LugarEntrada['traducciones'] = {};
  for (const [i, t] of Object.entries(f.textos)) {
    if (i !== 'es' && t.nombre.trim() === '') continue;
    traducciones[i] = {
      nombre: t.nombre.trim(), resumen: vacioANull(t.resumen), historia: vacioANull(t.historia), recomendaciones: vacioANull(t.recomendaciones),
      mejorEpoca: vacioANull(t.mejorEpoca), comoLlegar: vacioANull(t.comoLlegar),
    };
  }
  return { tipo: f.tipo, municipioId: f.municipioId, padreId: f.padreId, latitud: f.latitud, longitud: f.longitud, destacado: f.destacado, estado: f.estado, datos, traducciones };
}

// ---------------- rutas ----------------

export const DIFICULTADES_RUTA = [{ clave: 'facil', texto: 'Fácil' }, { clave: 'moderada', texto: 'Moderada' }, { clave: 'dificil', texto: 'Difícil' }];
export const TRANSPORTES_RUTA = [
  { clave: 'a_pie', texto: 'A pie' }, { clave: 'auto', texto: 'Auto' }, { clave: 'bicicleta', texto: 'Bicicleta' }, { clave: 'transporte_publico', texto: 'Transporte público' }, { clave: 'mixto', texto: 'Mixto' },
];
export const MAX_PARADAS = 40;

export interface ParadaForm {
  /** lugar · negocio · punto */
  tipo: 'lugar' | 'negocio' | 'punto';
  lugarId: string | null;
  negocioId: string | null;
  nombre: string;
  latitud: string;
  longitud: string;
  minutos: string;
}

export interface FormRuta {
  duracionHoras: string;
  distanciaKm: string;
  dificultad: string;
  transporte: string;
  esPremium: boolean;
  estado: string;
  textos: Record<string, { nombre: string; descripcion: string }>;
  paradas: ParadaForm[];
}

export const formRutaVacio = (): FormRuta => ({
  duracionHoras: '', distanciaKm: '', dificultad: 'facil', transporte: 'a_pie', esPremium: false, estado: 'borrador', textos: { es: { nombre: '', descripcion: '' } }, paradas: [],
});

export function formDeRuta(r: RutaAdmin): FormRuta {
  const textos: FormRuta['textos'] = {};
  for (const [i, t] of Object.entries(r.traducciones ?? {})) textos[i] = { nombre: t.nombre ?? '', descripcion: t.descripcion ?? '' };
  if (!textos['es']) textos['es'] = { nombre: '', descripcion: '' };
  return {
    duracionHoras: r.duracionHoras === null || r.duracionHoras === undefined ? '' : String(r.duracionHoras), distanciaKm: r.distanciaKm === null || r.distanciaKm === undefined ? '' : String(r.distanciaKm),
    dificultad: r.dificultad, transporte: r.transporte, esPremium: r.esPremium, estado: r.estado, textos,
    paradas: (r.paradas ?? []).map((p): ParadaForm => ({
      tipo: p.lugarId ? 'lugar' : p.negocioId ? 'negocio' : 'punto', lugarId: p.lugarId, negocioId: p.negocioId, nombre: '',
      latitud: p.latitud === null || p.latitud === undefined ? '' : String(p.latitud), longitud: p.longitud === null || p.longitud === undefined ? '' : String(p.longitud),
      minutos: p.minutosEstimados === null || p.minutosEstimados === undefined ? '' : String(p.minutosEstimados),
    })),
  };
}

/** Sube o baja una parada. Si no se puede mover, devuelve la misma lista. */
export function moverElemento<T>(l: T[], desde: number, hacia: number): T[] {
  if (desde < 0 || desde >= l.length || hacia < 0 || hacia >= l.length || desde === hacia) return l;
  const c = [...l];
  const [x] = c.splice(desde, 1);
  c.splice(hacia, 0, x);
  return c;
}

export function errorDeParada(p: ParadaForm): string | null {
  if (p.tipo === 'lugar' && !p.lugarId) return 'Elige el lugar.';
  if (p.tipo === 'negocio' && !p.negocioId) return 'Elige el negocio.';
  if (p.tipo === 'punto') {
    const lat = aNumero(p.latitud), lng = aNumero(p.longitud);
    if (lat === null || lng === null) return 'Escribe latitud y longitud.';
    const u = errorDeUbicacion(lat, lng);
    if (u) return u;
  }
  if (p.minutos.trim()) {
    const m = aNumero(p.minutos);
    if (m === null || m < 0 || !Number.isInteger(m)) return 'Minutos: un número entero, 0 o más.';
  }
  return null;
}

export function errorDeRuta(f: FormRuta): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.textos['es'] || f.textos['es'].nombre.trim() === '') e['nombre'] = 'Escribe el nombre en español.';
  for (const [i, t] of Object.entries(f.textos)) {
    const m = largoMax(t.nombre, 200, 'El nombre admite hasta 200 caracteres.') ?? largoMax(t.descripcion, 6000, 'La descripción admite hasta 6000 caracteres.');
    if (m) e['texto-' + i] = m;
    if (i !== 'es' && t.descripcion.trim() && t.nombre.trim() === '') e['nombre-' + i] = 'Si escribes este idioma, falta el nombre.';
  }
  const d = aNumero(f.duracionHoras);
  if (d === null || d < 0.1) e['duracionHoras'] = 'Indica la duración (0.1 horas o más).';
  if (f.distanciaKm.trim()) {
    const k = aNumero(f.distanciaKm);
    if (k === null || k < 0) e['distanciaKm'] = 'La distancia no puede ser negativa.';
  }
  if (f.paradas.length > MAX_PARADAS) e['paradas'] = `Máximo ${MAX_PARADAS} paradas.`;
  else if (f.estado === 'publicada' && f.paradas.length < 2) e['paradas'] = 'Para publicar agrega al menos 2 paradas.';
  f.paradas.forEach((p, i) => {
    const m = errorDeParada(p);
    if (m) e['parada-' + i] = m;
  });
  return e;
}

export function rutaParaApi(f: FormRuta): RutaEntrada {
  const traducciones: RutaEntrada['traducciones'] = {};
  for (const [i, t] of Object.entries(f.textos)) {
    if (i !== 'es' && t.nombre.trim() === '') continue;
    traducciones[i] = { nombre: t.nombre.trim(), descripcion: vacioANull(t.descripcion) };
  }
  const paradas: Parada[] = f.paradas.map((p) => ({
    lugarId: p.tipo === 'lugar' ? p.lugarId : null,
    negocioId: p.tipo === 'negocio' ? p.negocioId : null,
    latitud: p.tipo === 'punto' ? aNumero(p.latitud) : null,
    longitud: p.tipo === 'punto' ? aNumero(p.longitud) : null,
    minutosEstimados: p.minutos.trim() ? aNumero(p.minutos) : null,
  }));
  return {
    duracionHoras: aNumero(f.duracionHoras) ?? 0, distanciaKm: f.distanciaKm.trim() ? aNumero(f.distanciaKm) : null, dificultad: f.dificultad, transporte: f.transporte,
    esPremium: f.esPremium, estado: f.estado, traducciones, paradas,
  };
}

// ---------------- eventos ----------------

export interface FormEvento {
  fechaInicio: string;
  fechaFin: string;
  municipioId: string | null;
  temporadaId: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  gratis: boolean;
  costoTexto: string;
  horaInicio: string;
  horaFin: string;
  sede: string;
  textos: Record<string, { nombre: string; descripcion: string }>;
  negocios: { id: string; nombre: string }[];
}

export const MAX_NEGOCIOS_EVENTO = 50;

export const formEventoVacio = (): FormEvento => ({
  fechaInicio: '', fechaFin: '', municipioId: null, temporadaId: null, latitud: null, longitud: null, estado: 'borrador', gratis: false, costoTexto: '', horaInicio: '', horaFin: '', sede: '',
  textos: { es: { nombre: '', descripcion: '' } }, negocios: [],
});

export function formDeEvento(ev: EventoAdmin): FormEvento {
  const d: DatosEvento = ev.datos ?? {};
  const textos: FormEvento['textos'] = {};
  for (const [i, t] of Object.entries(ev.traducciones ?? {})) textos[i] = { nombre: t.nombre ?? '', descripcion: t.descripcion ?? '' };
  if (!textos['es']) textos['es'] = { nombre: '', descripcion: '' };
  return {
    fechaInicio: ev.fechaInicio, fechaFin: ev.fechaFin, municipioId: ev.municipioId, temporadaId: ev.temporadaId, latitud: ev.latitud, longitud: ev.longitud, estado: ev.estado,
    gratis: d.gratis === true, costoTexto: d.costoTexto ?? '', horaInicio: d.horaInicio ?? '', horaFin: d.horaFin ?? '', sede: d.sede ?? '', textos,
    negocios: (ev.negocioIds ?? []).map((id) => ({ id, nombre: '' })),
  };
}

const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function errorDeEvento(f: FormEvento): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.textos['es'] || f.textos['es'].nombre.trim() === '') e['nombre'] = 'Escribe el nombre en español.';
  for (const [i, t] of Object.entries(f.textos)) {
    const m = largoMax(t.nombre, 200, 'El nombre admite hasta 200 caracteres.') ?? largoMax(t.descripcion, 6000, 'La descripción admite hasta 6000 caracteres.');
    if (m) e['texto-' + i] = m;
    if (i !== 'es' && t.descripcion.trim() && t.nombre.trim() === '') e['nombre-' + i] = 'Si escribes este idioma, falta el nombre.';
  }
  if (!f.fechaInicio) e['fechaInicio'] = 'Indica cuándo empieza.';
  if (!f.fechaFin) e['fechaFin'] = 'Indica cuándo termina.';
  else if (f.fechaInicio && f.fechaFin < f.fechaInicio) e['fechaFin'] = 'Debe ser igual o posterior al inicio.';
  const u = errorDeUbicacion(f.latitud, f.longitud);
  if (u) e['latitud'] = u;
  if (f.horaInicio && !HORA.test(f.horaInicio)) e['horaInicio'] = 'Usa el formato HH:mm, por ejemplo 18:00.';
  if (f.horaFin && !HORA.test(f.horaFin)) e['horaFin'] = 'Usa el formato HH:mm, por ejemplo 18:00.';
  if (!f.gratis && f.costoTexto.length > 80) e['costoTexto'] = 'Máximo 80 caracteres.';
  if (f.sede.length > 120) e['sede'] = 'Máximo 120 caracteres.';
  if (f.negocios.length > MAX_NEGOCIOS_EVENTO) e['negocios'] = `Máximo ${MAX_NEGOCIOS_EVENTO} negocios.`;
  return e;
}

export function eventoParaApi(f: FormEvento): EventoEntrada {
  const datos: DatosEvento = {};
  if (f.gratis) datos.gratis = true;
  else if (f.costoTexto.trim()) datos.costoTexto = f.costoTexto.trim();
  if (f.horaInicio) datos.horaInicio = f.horaInicio;
  if (f.horaFin) datos.horaFin = f.horaFin;
  if (f.sede.trim()) datos.sede = f.sede.trim();
  const traducciones: EventoEntrada['traducciones'] = {};
  for (const [i, t] of Object.entries(f.textos)) {
    if (i !== 'es' && t.nombre.trim() === '') continue;
    traducciones[i] = { nombre: t.nombre.trim(), descripcion: vacioANull(t.descripcion) };
  }
  return {
    fechaInicio: f.fechaInicio, fechaFin: f.fechaFin, municipioId: f.municipioId, temporadaId: f.temporadaId, latitud: f.latitud, longitud: f.longitud, estado: f.estado, datos, traducciones,
    negocioIds: [...new Set(f.negocios.map((n) => n.id))],
  };
}

// ---------------- catálogos ----------------

export const GRUPOS_SERVICIO = [{ clave: 'hospedaje', texto: 'Hospedaje' }, { clave: 'comida', texto: 'Comida' }, { clave: 'tour', texto: 'Tour' }, { clave: 'general', texto: 'General' }];
export const grupoServicioTexto = (g: string): string => GRUPOS_SERVICIO.find((x) => x.clave === g)?.texto ?? g;

const CLAVE = /^[a-z][a-z0-9_]*$/;

export function errorDeClave(c: string): string | null {
  if (!c.trim()) return 'Escribe la clave.';
  return CLAVE.test(c.trim()) ? null : 'La clave solo lleva minúsculas, números y guion bajo.';
}

/** Aplana el árbol de categorías en filas con sangría para tablas y selectores. */
export function categoriasEnFilas(arbol: CategoriaCatalogo[], nivel = 0): { c: CategoriaCatalogo; nivel: number }[] {
  return arbol.flatMap((c) => [{ c, nivel }, ...categoriasEnFilas(c.hijas ?? [], nivel + 1)]);
}

export interface FormNombres {
  clave: string;
  icono: string;
  orden: string;
  activo: boolean;
  padreId: string;
  grupo: string;
  nombres: Record<string, string>;
}
export const formNombresVacio = (): FormNombres => ({ clave: '', icono: '', orden: '', activo: true, padreId: '', grupo: 'general', nombres: { es: '' } });

export function errorDeNombres(f: FormNombres, creando: boolean, conGrupo: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (creando) {
    const c = errorDeClave(f.clave);
    if (c) e['clave'] = c;
  }
  if (!(f.nombres['es'] ?? '').trim()) e['nombre-es'] = 'Escribe al menos el nombre en español.';
  for (const [i, v] of Object.entries(f.nombres)) if (v.length > 100) e['nombre-' + i] = 'Máximo 100 caracteres.';
  if (f.icono.length > 60) e['icono'] = 'Icono demasiado largo.';
  if (f.orden.trim()) {
    const o = aNumero(f.orden);
    if (o === null || !Number.isInteger(o)) e['orden'] = 'Un número entero.';
  }
  if (conGrupo && !f.grupo) e['grupo'] = 'Indica el grupo.';
  return e;
}

export function nombresParaApi(n: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [i, v] of Object.entries(n)) if (v.trim()) r[i] = v.trim();
  return r;
}

export interface FormGeo {
  nombre: string;
  claveInegi: string;
  latitud: string;
  longitud: string;
  activo: boolean;
  regionId: string;
}
export const formGeoVacio = (): FormGeo => ({ nombre: '', claveInegi: '', latitud: '', longitud: '', activo: true, regionId: '' });

export function errorDeGeo(f: FormGeo, esMunicipio: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.nombre.trim()) e['nombre'] = 'Escribe el nombre.';
  else if (f.nombre.length > 120) e['nombre'] = 'Nombre demasiado largo.';
  if (esMunicipio) {
    if (!f.regionId) e['regionId'] = 'Indica la región.';
    if (f.claveInegi.trim() && !/^[0-9]{5}$/.test(f.claveInegi.trim())) e['claveInegi'] = 'La clave INEGI tiene 5 dígitos, por ejemplo 20067.';
  }
  const lat = f.latitud.trim() ? aNumero(f.latitud) : null;
  const lng = f.longitud.trim() ? aNumero(f.longitud) : null;
  if ((f.latitud.trim() && lat === null) || (f.longitud.trim() && lng === null)) e['latitud'] = 'Escribe números válidos.';
  else {
    const u = errorDeUbicacion(lat, lng);
    if (u) e['latitud'] = u;
  }
  return e;
}

export const numeroONull = (t: string): number | null => (t.trim() ? aNumero(t) : null);
