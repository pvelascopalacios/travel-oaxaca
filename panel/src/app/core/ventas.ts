import { AfiliadoEntrada, ClicDia, ErrorFila, Importacion, Interaccion, ProspectoDetalle, ProspectoEntrada, ProspectoResumen } from './modelos';
import { normalizarRol } from './panel';

// ---------------- prospectos ----------------

export interface EstadoInfo {
  clave: string;
  texto: string;
  clase: string;
}

export const ESTADOS_PROSPECTO: EstadoInfo[] = [
  { clave: 'nuevo', texto: 'Nuevo', clase: 'nueva' },
  { clave: 'contactado', texto: 'Contactado', clase: 'cambio' },
  { clave: 'interesado', texto: 'Interesado', clase: 'cambio' },
  { clave: 'en_alta', texto: 'En alta', clase: 'cambio' },
  { clave: 'convertido', texto: 'Convertido', clase: 'ok' },
  { clave: 'descartado', texto: 'Descartado', clase: 'gris' },
];
export const estadoProspecto = (e: string): EstadoInfo => ESTADOS_PROSPECTO.find((x) => x.clave === e) ?? { clave: e, texto: e, clase: 'gris' };

export const ORIGENES = [
  { clave: 'facebook', texto: 'Facebook' },
  { clave: 'visita', texto: 'Visita' },
  { clave: 'referido', texto: 'Referido' },
  { clave: 'formulario_web', texto: 'Formulario web' },
  { clave: 'evento', texto: 'Evento' },
  { clave: 'otro', texto: 'Otro' },
];
export const origenTexto = (o: string | null): string => ORIGENES.find((x) => x.clave === o)?.texto ?? (o ?? '');

export const TIPOS_INTERACCION = [
  { clave: 'llamada', texto: 'Llamada', corto: 'LL' },
  { clave: 'visita', texto: 'Visita', corto: 'VI' },
  { clave: 'whatsapp', texto: 'WhatsApp', corto: 'WA' },
  { clave: 'correo', texto: 'Correo', corto: 'CO' },
  { clave: 'demo', texto: 'Demo', corto: 'DE' },
  { clave: 'nota', texto: 'Nota', corto: 'NO' },
];
export const tipoInteraccion = (t: string) => TIPOS_INTERACCION.find((x) => x.clave === t) ?? { clave: t, texto: t, corto: t.slice(0, 2).toUpperCase() };

/** Estados a los que se puede pasar a mano (convertir tiene su acción; un convertido ya no cambia). */
export function estadosSiguientes(estado: string): EstadoInfo[] {
  if (estado === 'convertido') return [];
  return ESTADOS_PROSPECTO.filter((e) => e.clave !== estado && e.clave !== 'convertido');
}

export const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface FormProspecto {
  nombreNegocio: string;
  categoriaId: string;
  municipioId: string;
  contactoNombre: string;
  telefono: string;
  correo: string;
  origen: string;
  asignadoA: string;
  proximaAccionEn: string;
  notas: string;
}

export const formProspectoVacio = (): FormProspecto => ({ nombreNegocio: '', categoriaId: '', municipioId: '', contactoNombre: '', telefono: '', correo: '', origen: 'otro', asignadoA: '', proximaAccionEn: '', notas: '' });

export function formDeProspecto(d: ProspectoDetalle): FormProspecto {
  const p = d.prospecto;
  return {
    nombreNegocio: p.nombreNegocio, categoriaId: p.categoriaId ?? '', municipioId: p.municipioId ?? '', contactoNombre: p.contactoNombre ?? '',
    telefono: p.telefono ?? '', correo: p.correo ?? '', origen: p.origen ?? 'otro', asignadoA: p.asignadoA ?? '', proximaAccionEn: p.proximaAccionEn ?? '', notas: d.notas ?? '',
  };
}

export function errorDeProspecto(f: FormProspecto): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.nombreNegocio.trim()) e['nombreNegocio'] = 'Escribe el nombre del negocio.';
  else if (f.nombreNegocio.trim().length > 160) e['nombreNegocio'] = 'Máximo 160 caracteres.';
  if (f.contactoNombre.length > 120) e['contactoNombre'] = 'Máximo 120 caracteres.';
  if (f.telefono.length > 30) e['telefono'] = 'Máximo 30 caracteres.';
  if (f.correo.trim() && (f.correo.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim()))) e['correo'] = 'Escribe un correo válido.';
  if (f.notas.length > 2000) e['notas'] = 'Máximo 2000 caracteres.';
  return e;
}

const vacioANull = (s: string): string | null => (s.trim() ? s.trim() : null);

export function prospectoParaApi(f: FormProspecto): ProspectoEntrada {
  return {
    nombreNegocio: f.nombreNegocio.trim(), categoriaId: f.categoriaId || null, municipioId: f.municipioId || null, contactoNombre: vacioANull(f.contactoNombre),
    telefono: vacioANull(f.telefono), correo: vacioANull(f.correo), origen: f.origen || 'otro', asignadoA: f.asignadoA || null, proximaAccionEn: f.proximaAccionEn || null, notas: vacioANull(f.notas),
  };
}

export interface FormInteraccion {
  tipo: string;
  cuando: string;
  resultado: string;
  notas: string;
  proximaAccionEn: string;
}
export const formInteraccionVacio = (): FormInteraccion => ({ tipo: 'llamada', cuando: '', resultado: '', notas: '', proximaAccionEn: '' });

export function errorDeInteraccion(f: FormInteraccion, hoy = hoyISO()): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.tipo) e['tipo'] = 'Elige el tipo de contacto.';
  if (f.resultado.length > 300) e['resultado'] = 'Máximo 300 caracteres.';
  if (f.notas.length > 2000) e['notas'] = 'Máximo 2000 caracteres.';
  if (f.proximaAccionEn && f.proximaAccionEn < hoy) e['proximaAccionEn'] = 'Elige hoy o una fecha futura.';
  return e;
}

export function interaccionParaApi(f: FormInteraccion) {
  return {
    tipo: f.tipo, resultado: vacioANull(f.resultado), notas: vacioANull(f.notas),
    ocurrioEn: f.cuando ? new Date(f.cuando).toISOString() : null, proximaAccionEn: f.proximaAccionEn || null,
  };
}

export const MOTIVO_DESCARTE_MAX = 500;
export function errorDeDescarte(m: string): string | null {
  if (!m.trim()) return 'El motivo es obligatorio.';
  if (m.trim().length > MOTIVO_DESCARTE_MAX) return `Máximo ${MOTIVO_DESCARTE_MAX} caracteres.`;
  return null;
}

/** Qué falta para convertir en negocio. */
export function faltaParaConvertir(p: Pick<ProspectoResumen, 'categoriaId' | 'municipioId'>, categoria: string, municipio: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!(categoria || p.categoriaId)) e['categoriaId'] = 'Elige la categoría del negocio.';
  if (!(municipio || p.municipioId)) e['municipioId'] = 'Elige el municipio del negocio.';
  return e;
}

export const puedeEliminar = (p: Pick<ProspectoResumen, 'estado' | 'negocioId'>): boolean => p.estado !== 'convertido' && !p.negocioId;

export const ultimaInteraccion = (l: Interaccion[]): Interaccion | null => (l.length ? [...l].sort((a, b) => b.ocurrioEn.localeCompare(a.ocurrioEn))[0] : null);

// ---------------- importaciones ----------------

export const TIPOS_IMPORTACION = [
  { clave: 'prospectos', texto: 'Prospectos', requiere: 'nombre_negocio' },
  { clave: 'negocios', texto: 'Negocios', requiere: 'nombre, categoria, municipio' },
  { clave: 'lugares', texto: 'Lugares', requiere: 'nombre, tipo, municipio' },
  { clave: 'eventos', texto: 'Eventos', requiere: 'titulo, municipio, fecha_inicio, fecha_fin' },
];
export const tipoImportacionTexto = (t: string): string => TIPOS_IMPORTACION.find((x) => x.clave === t)?.texto ?? t;

/** Tipos que cada rol puede importar: ventas, prospectos; editor, el resto; admin, todos. */
export function tiposImportables(roles: string[] | null | undefined): typeof TIPOS_IMPORTACION {
  const r = (roles ?? []).map(normalizarRol);
  if (r.includes('admin')) return TIPOS_IMPORTACION;
  return TIPOS_IMPORTACION.filter((t) => (t.clave === 'prospectos' ? r.includes('ventas') : r.includes('editor')));
}

export const MAX_BYTES_CSV = 2 * 1024 * 1024;
export function errorDeArchivoCsv(a: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(a.name)) return 'El archivo debe ser .csv.';
  if (a.size === 0) return 'El archivo está vacío.';
  if (a.size > MAX_BYTES_CSV) return 'El archivo pesa más de 2 MB.';
  return null;
}

export const ESTADOS_IMPORTACION: EstadoInfo[] = [
  { clave: 'validada', texto: 'Por revisar', clase: 'cambio' },
  { clave: 'aplicada', texto: 'Aplicada', clase: 'ok' },
  { clave: 'cancelada', texto: 'Cancelada', clase: 'gris' },
  { clave: 'fallida', texto: 'Fallida', clase: 'mal' },
];
export const estadoImportacion = (e: string): EstadoInfo => ESTADOS_IMPORTACION.find((x) => x.clave === e) ?? { clave: e, texto: e, clase: 'gris' };

/** Una importación se puede aplicar o cancelar mientras no esté cerrada. */
export const estaAbierta = (i: Pick<Importacion, 'estado'>): boolean => !['aplicada', 'cancelada', 'fallida'].includes(i.estado);

export function planDeAplicar(i: Pick<Importacion, 'filasOk' | 'filasError'>): { puede: boolean; pideConfirmar: boolean; texto: string } {
  if (i.filasOk === 0) return { puede: false, pideConfirmar: false, texto: 'No hay filas correctas para aplicar. Corrige el archivo y súbelo de nuevo.' };
  if (i.filasError > 0) return { puede: true, pideConfirmar: true, texto: `Aplicar solo las ${i.filasOk} correctas…` };
  return { puede: true, pideConfirmar: false, texto: `Aplicar las ${i.filasOk} filas` };
}

export const MAX_ERRORES_GUARDADOS = 500;
export const hayErroresSinMostrar = (i: Pick<Importacion, 'filasError'>, errores: ErrorFila[] | null): boolean => i.filasError > (errores?.length ?? 0);

// ---------------- afiliados ----------------

export const ESTADOS_AFILIADO: EstadoInfo[] = [
  { clave: 'activo', texto: 'Activo', clase: 'ok' },
  { clave: 'pausado', texto: 'Pausado', clase: 'gris' },
];
export const estadoAfiliado = (e: string): EstadoInfo => ESTADOS_AFILIADO.find((x) => x.clave === e) ?? { clave: e, texto: e, clase: 'gris' };

export interface FormAfiliado {
  codigo: string;
  destinoUrl: string;
  socio: string;
  comisionPct: string;
  estado: string;
  negocioId: string;
  negocioNombre: string;
}
export const formAfiliadoVacio = (): FormAfiliado => ({ codigo: '', destinoUrl: '', socio: '', comisionPct: '', estado: 'activo', negocioId: '', negocioNombre: '' });

export function errorDeAfiliado(f: FormAfiliado): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.codigo.trim()) e['codigo'] = 'Escribe el código.';
  else if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(f.codigo.trim())) e['codigo'] = 'Usa de 3 a 40 letras minúsculas, números o guiones.';
  if (!f.destinoUrl.trim()) e['destinoUrl'] = 'Escribe la dirección de destino.';
  else if (!/^https?:\/\/\S+$/i.test(f.destinoUrl.trim()) || f.destinoUrl.length > 2000) e['destinoUrl'] = 'Escribe una dirección que empiece con http:// o https://.';
  if (!f.socio.trim()) e['socio'] = 'Escribe el nombre del socio.';
  else if (f.socio.trim().length > 160) e['socio'] = 'Máximo 160 caracteres.';
  if (f.comisionPct.trim()) {
    const n = Number(f.comisionPct.replace(',', '.'));
    if (isNaN(n) || n < 0 || n > 100) e['comisionPct'] = 'Escribe un número de 0 a 100.';
  }
  return e;
}

export function afiliadoParaApi(f: FormAfiliado): AfiliadoEntrada {
  return {
    codigo: f.codigo.trim(), destinoUrl: f.destinoUrl.trim(), socio: f.socio.trim(),
    comisionPct: f.comisionPct.trim() ? Number(f.comisionPct.replace(',', '.')) : null, negocioId: f.negocioId || null, estado: f.estado || 'activo',
  };
}

export interface ResumenClics {
  total: number;
  maximo: number;
  diaMaximo: string | null;
}
export function resumenClics(l: ClicDia[]): ResumenClics {
  let max = 0;
  let dia: string | null = null;
  let total = 0;
  for (const c of l) {
    total += c.clics;
    if (c.clics > max) { max = c.clics; dia = c.dia; }
  }
  return { total, maximo: max, diaMaximo: dia };
}

/** Rellena con ceros los días sin clics entre dos fechas (la API puede omitirlos). */
export function completarDias(l: ClicDia[], desde: string, hasta: string): ClicDia[] {
  const mapa = new Map(l.map((c) => [c.dia, c.clics]));
  const salida: ClicDia[] = [];
  const d = new Date(desde + 'T12:00:00');
  const fin = new Date(hasta + 'T12:00:00');
  for (let n = 0; d <= fin && n < 400; n++, d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    salida.push({ dia: k, clics: mapa.get(k) ?? 0 });
  }
  return salida;
}

export function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Guarda un archivo que llegó como blob (plantilla, errores). */
export function guardarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
