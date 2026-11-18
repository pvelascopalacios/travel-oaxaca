import { Auditoria, Campana, CampanaEntrada, Configuracion, Espacio, EspacioEntrada, Notificacion, Patrocinio, PatrocinioEntrada } from './modelos';
import { EstadoInfo } from './ventas';

// ---------------- patrocinios ----------------

export const ESPACIOS = [
  { clave: 'destacado_explorar', texto: 'Destacados en Explorar' },
  { clave: 'destacado_categoria', texto: 'Destacados por categoría' },
  { clave: 'banner_mapa', texto: 'Banner del mapa' },
  { clave: 'resultado_busqueda', texto: 'Resultado de búsqueda' },
];
export const espacioTexto = (c: string): string => ESPACIOS.find((x) => x.clave === c)?.texto ?? c;

export const ESTADOS_PATROCINIO: EstadoInfo[] = [
  { clave: 'programado', texto: 'Programado', clase: 'cambio' },
  { clave: 'activo', texto: 'Activo', clase: 'ok' },
  { clave: 'cancelado', texto: 'Cancelado', clase: 'gris' },
  { clave: 'terminado', texto: 'Terminado', clase: 'gris' },
];
export const estadoPatrocinio = (e: string): EstadoInfo => ESTADOS_PATROCINIO.find((x) => x.clave === e) ?? { clave: e, texto: e, clase: 'gris' };
export const puedeCancelarPatrocinio = (p: Pick<Patrocinio, 'estado'>): boolean => p.estado === 'programado' || p.estado === 'activo';

export const METODOS_PAGO = [
  { clave: 'transferencia', texto: 'Transferencia' },
  { clave: 'efectivo', texto: 'Efectivo' },
  { clave: 'enlace_pago', texto: 'Enlace de pago' },
];

export interface FormPatrocinio {
  espacioId: string;
  negocioId: string;
  negocioNombre: string;
  inicio: string;
  fin: string;
  precio: string;
  cupon: string;
  conPago: boolean;
  metodo: string;
  referencia: string;
  pagado: boolean;
}
export const formPatrocinioVacio = (inicio = ''): FormPatrocinio => ({ espacioId: '', negocioId: '', negocioNombre: '', inicio, fin: '', precio: '', cupon: '', conPago: false, metodo: 'transferencia', referencia: '', pagado: false });

export const numeroDe = (t: string): number => Number(t.trim().replace(/,/g, '.'));

export function errorDePatrocinio(f: FormPatrocinio): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.espacioId) e['espacioId'] = 'Elige el espacio.';
  if (!f.negocioId) e['negocioId'] = 'Elige el negocio.';
  if (!f.inicio) e['inicio'] = 'Indica cuándo empieza.';
  if (!f.fin) e['fin'] = 'Indica cuándo termina.';
  else if (f.inicio && f.fin < f.inicio) e['fin'] = 'Debe ser igual o posterior al inicio.';
  if (!f.precio.trim()) e['precio'] = 'Escribe el precio.';
  else {
    const n = numeroDe(f.precio);
    if (isNaN(n) || n < 0) e['precio'] = 'El precio debe ser un número de 0 en adelante.';
  }
  if (f.cupon.trim().length > 30) e['cupon'] = 'Máximo 30 caracteres.';
  if (f.conPago && f.referencia.trim().length > 100) e['referencia'] = 'Máximo 100 caracteres.';
  return e;
}

export function patrocinioParaApi(f: FormPatrocinio): PatrocinioEntrada {
  return {
    espacioId: f.espacioId,
    negocioId: f.negocioId,
    inicio: f.inicio,
    fin: f.fin,
    precio: numeroDe(f.precio),
    cupon: f.cupon.trim() || null,
    pago: f.conPago ? { metodo: f.metodo, referencia: f.referencia.trim() || null, pagado: f.pagado } : null,
  };
}

export interface FormEspacio {
  clave: string;
  destinoId: string;
  categoriaId: string;
  regionId: string;
  maxSimultaneos: string;
  activo: boolean;
}
export const formEspacioVacio = (): FormEspacio => ({ clave: 'destacado_explorar', destinoId: '', categoriaId: '', regionId: '', maxSimultaneos: '1', activo: true });
export const formDeEspacio = (e: Espacio): FormEspacio => ({ clave: e.clave, destinoId: e.destinoId ?? '', categoriaId: e.categoriaId ?? '', regionId: e.regionId ?? '', maxSimultaneos: String(e.maxSimultaneos), activo: e.activo });

export function errorDeEspacio(f: FormEspacio): Record<string, string> {
  const e: Record<string, string> = {};
  if (!ESPACIOS.some((x) => x.clave === f.clave)) e['clave'] = 'Elige un espacio de la lista.';
  const n = Number(f.maxSimultaneos);
  if (!f.maxSimultaneos.trim() || !Number.isInteger(n) || n < 1) e['maxSimultaneos'] = 'Escribe un número entero, al menos 1.';
  return e;
}
export const espacioParaApi = (f: FormEspacio): EspacioEntrada => ({ clave: f.clave, destinoId: f.destinoId || null, categoriaId: f.categoriaId || null, regionId: f.regionId || null, maxSimultaneos: Number(f.maxSimultaneos), activo: f.activo });

const MS_DIA = 86400000;
const aDia = (iso: string): number => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / MS_DIA);

/** Posición de una barra del calendario, en % del rango [desde, hasta]. Null si cae fuera. */
export function barraCalendario(p: Pick<Patrocinio, 'inicio' | 'fin'>, desde: string, hasta: string): { izq: number; ancho: number } | null {
  const d0 = aDia(desde), d1 = aDia(hasta), i = aDia(p.inicio), f = aDia(p.fin);
  if (f < d0 || i > d1) return null;
  const total = d1 - d0 + 1;
  const a = Math.max(i, d0), b = Math.min(f, d1);
  return { izq: ((a - d0) / total) * 100, ancho: Math.max(((b - a + 1) / total) * 100, 1.5) };
}

export interface FilaCalendario {
  clave: string;
  espacioId: string;
  etiqueta: string;
  items: (Patrocinio & { izq: number; ancho: number; carril: number })[];
  carriles: number;
}

/** Agrupa por espacio y reparte en carriles para que no se encimen. */
export function filasCalendario(l: Patrocinio[], desde: string, hasta: string): FilaCalendario[] {
  const mapa = new Map<string, FilaCalendario>();
  for (const p of [...l].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const b = barraCalendario(p, desde, hasta);
    if (!b) continue;
    let fila = mapa.get(p.espacioId);
    if (!fila) { fila = { clave: p.espacioClave, espacioId: p.espacioId, etiqueta: espacioTexto(p.espacioClave), items: [], carriles: 0 }; mapa.set(p.espacioId, fila); }
    const fin: number[] = [];
    fila.items.forEach((x) => { fin[x.carril] = Math.max(fin[x.carril] ?? -1, aDia(x.fin)); });
    let carril = 0;
    while ((fin[carril] ?? -1) >= aDia(p.inicio)) carril++;
    fila.items.push({ ...p, ...b, carril });
    fila.carriles = Math.max(fila.carriles, carril + 1);
  }
  return [...mapa.values()];
}

/** Cuántos patrocinios vigentes (programado o activo) se cruzan con un día; para comparar con el cupo. */
export function ocupacion(l: Patrocinio[], espacioId: string, dia: string): number {
  return l.filter((p) => p.espacioId === espacioId && puedeCancelarPatrocinio(p) && p.inicio <= dia && p.fin >= dia).length;
}

export function sumaDias(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * MS_DIA);
  return d.toISOString().slice(0, 10);
}

// ---------------- métricas y campañas ----------------

export const PERIODOS = [7, 30, 90];
export const tasaTexto = (t: number | null | undefined): string => (t === null || t === undefined ? '—' : `${(Math.round(t * 1000) / 10).toLocaleString('es-MX')} %`);
export const DIAS_SIN_CONTACTO_ALERTA = 14;
export const sinContactoAlerta = (dias: number, vistas: number): boolean => vistas > 0 && dias >= DIAS_SIN_CONTACTO_ALERTA;

export interface FormCampana {
  origen: string;
  codigo: string;
  nombre: string;
  inicio: string;
  fin: string;
}
export const formCampanaVacio = (): FormCampana => ({ origen: '', codigo: '', nombre: '', inicio: '', fin: '' });
export const formDeCampana = (c: Campana): FormCampana => ({ origen: c.origenClave, codigo: c.codigo, nombre: c.nombre, inicio: c.inicio ?? '', fin: c.fin ?? '' });

export function errorDeCampana(f: FormCampana, nueva: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.origen) e['origen'] = 'Elige el origen.';
  if (nueva) {
    if (!f.codigo.trim()) e['codigo'] = 'Escribe el código.';
    else if (!/^[a-z0-9_-]{2,40}$/.test(f.codigo.trim())) e['codigo'] = 'Usa minúsculas, números, guion y guion bajo (2 a 40).';
  }
  if (!f.nombre.trim()) e['nombre'] = 'Escribe el nombre.';
  else if (f.nombre.trim().length > 120) e['nombre'] = 'Máximo 120 caracteres.';
  if (f.inicio && f.fin && f.fin < f.inicio) e['fin'] = 'Debe ser igual o posterior al inicio.';
  return e;
}
export const campanaParaApi = (f: FormCampana, nueva: boolean): CampanaEntrada => ({ origen: f.origen, ...(nueva ? { codigo: f.codigo.trim() } : {}), nombre: f.nombre.trim(), inicio: f.inicio || null, fin: f.fin || null });
export const enlaceCampana = (base: string, codigo: string): string => `${base.replace(/\/+$/, '')}/?o=${codigo}`;

// ---------------- auditoría ----------------

export const ACCIONES_AUDITORIA = [
  { clave: 'insert', texto: 'Alta', clase: 'ok' },
  { clave: 'update', texto: 'Cambio', clase: 'cambio' },
  { clave: 'delete', texto: 'Baja', clase: 'mal' },
];
export const accionAuditoria = (a: string): EstadoInfo => { const x = ACCIONES_AUDITORIA.find((y) => y.clave === a); return { clave: a, texto: x?.texto ?? a, clase: x?.clase ?? 'gris' }; };

export function textoValor(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v === '' ? '(vacío)' : v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export interface DiferenciaAuditoria {
  campo: string;
  antes: string;
  despues: string;
}

/** Solo los campos que cambian (alta: todos los nuevos; baja: todos los anteriores). */
export function diferencias(a: Pick<Auditoria, 'antes' | 'despues'>): DiferenciaAuditoria[] {
  const antes = a.antes ?? {}, despues = a.despues ?? {};
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].sort();
  return claves
    .filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(despues[k] ?? null))
    .map((k) => ({ campo: k, antes: textoValor(antes[k]), despues: textoValor(despues[k]) }));
}

// ---------------- configuración ----------------

export const GRUPOS_CONFIG = [
  { clave: 'comunidad', texto: 'Comunidad', claves: ['resena_editable_dias', 'comentario_editable_minutos', 'reportes_para_ocultar', 'comentarios_max_por_hora', 'reportes_max_por_hora', 'resenas_min_para_promedio', 'listas_max_por_usuario', 'fotos_max_resena'] },
  { clave: 'comercial', texto: 'Planes y cobros', claves: ['dias_gracia', 'estadisticas_gratis_dias', 'fotos_minimas_publicar'] },
  { clave: 'avisos', texto: 'Avisos a negocios', claves: ['aviso_vencimiento_dias_1', 'aviso_vencimiento_dias_2', 'aviso_patrocinio_dias'] },
  { clave: 'apps', texto: 'Apps y anuncios', claves: ['anuncios_terceros_activos', 'umbral_usuarios_para_anuncios', 'reservas_activas'] },
  { clave: 'legal', texto: 'Legal', claves: ['version_terminos', 'version_privacidad'] },
];
export function grupoConfig(clave: string): string {
  return GRUPOS_CONFIG.find((g) => g.claves.includes(clave))?.clave ?? 'otros';
}
export const SENSIBLES = ['anuncios_terceros_activos', 'reservas_activas', 'version_terminos', 'version_privacidad'];
export const esSensible = (clave: string): boolean => SENSIBLES.includes(clave);

export function agruparConfig(l: Configuracion[]): { clave: string; texto: string; items: Configuracion[] }[] {
  const salida = [...GRUPOS_CONFIG.map((g) => ({ clave: g.clave, texto: g.texto })), { clave: 'otros', texto: 'Otros' }]
    .map((g) => ({ ...g, items: l.filter((c) => grupoConfig(c.clave) === g.clave) }))
    .filter((g) => g.items.length);
  return salida;
}

export function valorComoTexto(c: Pick<Configuracion, 'tipo' | 'valor'>): string {
  if (c.tipo === 'texto') return typeof c.valor === 'string' ? c.valor : '';
  if (c.tipo === 'entero') return c.valor === null || c.valor === undefined ? '' : String(c.valor);
  if (c.tipo === 'booleano') return c.valor ? 'true' : 'false';
  return JSON.stringify(c.valor ?? null, null, 2);
}

/** Convierte lo escrito al valor que espera la API, o devuelve el error que se mostraría. */
export function valorParaApi(c: Pick<Configuracion, 'tipo' | 'minimo' | 'maximo'>, texto: string): { valor: unknown } | { error: string } {
  const t = texto.trim();
  switch (c.tipo) {
    case 'entero': {
      if (!/^-?\d+$/.test(t)) return { error: 'Escribe un número entero.' };
      const n = Number(t);
      if (c.minimo !== null && c.minimo !== undefined && n < c.minimo) return { error: `No puede ser menor que ${c.minimo}.` };
      if (c.maximo !== null && c.maximo !== undefined && n > c.maximo) return { error: `No puede ser mayor que ${c.maximo}.` };
      return { valor: n };
    }
    case 'booleano':
      return t === 'true' || t === 'false' ? { valor: t === 'true' } : { error: 'Usa verdadero o falso.' };
    case 'texto':
      return texto.trim() ? { valor: texto.trim() } : { error: 'Escribe un texto.' };
    default:
      try {
        const v = JSON.parse(t);
        return v !== null && typeof v === 'object' ? { valor: v } : { error: 'Escribe un objeto o una lista en formato JSON.' };
      } catch {
        return { error: 'El JSON no es válido.' };
      }
  }
}
export const rangoTexto = (c: Pick<Configuracion, 'tipo' | 'minimo' | 'maximo'>): string => {
  if (c.tipo === 'booleano') return 'sí / no';
  if (c.tipo === 'entero') return c.minimo !== null && c.maximo !== null ? `${c.minimo} a ${c.maximo}` : c.minimo !== null ? `desde ${c.minimo}` : c.maximo !== null ? `hasta ${c.maximo}` : 'entero';
  return c.tipo === 'texto' ? 'texto' : 'JSON';
};

// ---------------- plantillas y notificaciones ----------------

export const PLANTILLA_ASUNTO_MAX = 200;
export const PLANTILLA_CUERPO_MAX = 5000;

export function variablesEnUso(...textos: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const t of textos) for (const m of (t ?? '').matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) s.add(m[1]);
  return [...s];
}
/** Variables mal escritas: con espacios dentro de las llaves. La API solo acepta {{nombre}} pegado. */
export function variablesConEspacios(t: string): boolean {
  return /\{\{\s+[^{}]*\}\}|\{\{[^{}]*\s+\}\}/.test(t);
}

export function errorDePlantilla(p: Pick<{ canal: string; variables: string[] }, 'canal' | 'variables'>, asunto: string, cuerpo: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.canal === 'correo' && !asunto.trim()) e['asunto'] = 'Los correos necesitan asunto.';
  else if (asunto.length > PLANTILLA_ASUNTO_MAX) e['asunto'] = `Máximo ${PLANTILLA_ASUNTO_MAX} caracteres.`;
  if (!cuerpo.trim()) e['cuerpo'] = 'Escribe el mensaje.';
  else if (cuerpo.length > PLANTILLA_CUERPO_MAX) e['cuerpo'] = `Máximo ${PLANTILLA_CUERPO_MAX} caracteres.`;
  else if (variablesConEspacios(asunto) || variablesConEspacios(cuerpo)) e['cuerpo'] = 'Usa las variables sin espacios dentro de las llaves, por ejemplo {{nombre}}.';
  else {
    const raras = variablesEnUso(asunto, cuerpo).filter((v) => !p.variables.includes(v));
    if (raras.length) e['cuerpo'] = `Variables que esta plantilla no admite: ${raras.map((v) => `{{${v}}}`).join(', ')}.`;
  }
  return e;
}

export const ESTADOS_COLA: EstadoInfo[] = [
  { clave: 'pendiente', texto: 'Pendiente', clase: 'cambio' },
  { clave: 'enviada', texto: 'Enviada', clase: 'ok' },
  { clave: 'leida', texto: 'Leída', clase: 'ok' },
  { clave: 'fallida', texto: 'Fallida', clase: 'mal' },
  { clave: 'cancelada', texto: 'Cancelada', clase: 'gris' },
];
export const estadoCola = (e: string): EstadoInfo => ESTADOS_COLA.find((x) => x.clave === e) ?? { clave: e, texto: e, clase: 'gris' };
export const puedeReintentar = (n: Pick<Notificacion, 'estado'>): boolean => n.estado === 'fallida';
