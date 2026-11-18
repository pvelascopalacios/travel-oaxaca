import { Miembro, Pago, PlanPublico, Promocion, PromocionEntrada, PrecioPlan, Suscripcion } from './modelos';
import { aNumero, vacioANull } from './edicion';
import { fechaCorta } from './portal';

// ---------------- fechas ----------------

const dos = (n: number): string => String(n).padStart(2, '0');

/** Hoy en la hora del navegador, como `AAAA-MM-DD` (así viajan las fechas a la API). */
export function hoyIso(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000);
}

/** «15 nov – 15 dic 2026»; si cruzan de año, cada fecha lleva el suyo. */
export function periodoTexto(inicio: string, fin: string): string {
  const mismoAnio = inicio.slice(0, 4) === fin.slice(0, 4);
  const corta = (f: string): string => fechaCorta(f, { day: 'numeric', month: 'short' }).replace('.', '');
  const larga = (f: string): string => fechaCorta(f, { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  return mismoAnio ? `${corta(inicio)} – ${larga(fin)}` : `${larga(inicio)} – ${larga(fin)}`;
}

export const fechaLarga = (iso: string | null | undefined): string => (iso ? fechaCorta(iso).replace(/\./g, '') : '');

// ---------------- promociones ----------------

export const MAX_DIAS_PROMO = 365;

export const TIPOS_PROMO = [
  { clave: 'descuento_pct', simbolo: '%', texto: 'Descuento en porcentaje' },
  { clave: 'descuento_monto', simbolo: '$', texto: 'Descuento en pesos' },
  { clave: 'dos_por_uno', simbolo: '2×1', texto: 'Dos por uno' },
  { clave: 'regalo', simbolo: 'Regalo', texto: 'Regalo' },
] as const;

export const usaValor = (tipo: string): boolean => tipo === 'descuento_pct' || tipo === 'descuento_monto';
export const tipoPromoTexto = (t: string): string => TIPOS_PROMO.find((x) => x.clave === t)?.texto ?? t;

export function estadoPromo(e: string): { texto: string; clase: string } {
  switch (e) {
    case 'activa': return { texto: 'Activa', clase: 'activa' };
    case 'borrador': return { texto: 'Borrador', clase: 'borrador' };
    case 'en_revision': return { texto: 'En revisión', clase: 'en_revision' };
    case 'vencida': return { texto: 'Vencida', clase: 'vencida' };
    default: return { texto: e, clase: 'borrador' };
  }
}

function numeroTexto(n: number): string {
  return Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

/** Lo grande de la tarjeta: «15 %», «$500», «2×1» o «Regalo». */
export function valorPromo(p: { tipo: string; valor: number | null }): { grande: string; pie: string } {
  switch (p.tipo) {
    case 'descuento_pct': return { grande: `${numeroTexto(p.valor ?? 0)} %`, pie: 'de descuento' };
    case 'descuento_monto': return { grande: `$${numeroTexto(p.valor ?? 0)}`, pie: 'de descuento' };
    case 'dos_por_uno': return { grande: '2×1', pie: '' };
    default: return { grande: 'Regalo', pie: '' };
  }
}

/** Texto corto para la vista previa: «15 % de descuento». */
export function insignia(p: { tipo: string; valor: number | null }): string {
  const v = valorPromo(p);
  return v.pie ? `${v.grande} ${v.pie}` : v.grande;
}

/** Activas primero, luego en revisión, borradores y vencidas; dentro de cada grupo, la que empieza antes. */
export function ordenarPromos(lista: Promocion[]): Promocion[] {
  const rango: Record<string, number> = { activa: 0, en_revision: 1, borrador: 2, vencida: 3 };
  return [...lista].sort((a, b) => (rango[a.estado] ?? 9) - (rango[b.estado] ?? 9) || a.inicio.localeCompare(b.inicio));
}

export function tituloDe(p: Promocion): string {
  return p.textos.find((t) => t.idioma === 'es')?.titulo ?? p.textos[0]?.titulo ?? '(sin título)';
}
export function descripcionDe(p: Promocion): string | null {
  return p.textos.find((t) => t.idioma === 'es')?.descripcion ?? null;
}

export interface FormPromo {
  tipo: string;
  titulo: Record<string, string>;
  descripcion: Record<string, string>;
  valor: string;
  ofertaId: string;
  codigo: string;
  inicio: string;
  fin: string;
  condiciones: string;
}

export function formVacioPromo(hoy: string = hoyIso()): FormPromo {
  return { tipo: 'descuento_pct', titulo: { es: '', en: '' }, descripcion: { es: '', en: '' }, valor: '', ofertaId: '', codigo: '', inicio: hoy, fin: sumarDias(hoy, 30), condiciones: '' };
}

export function formDePromo(p: Promocion): FormPromo {
  const f = formVacioPromo(p.inicio);
  f.tipo = p.tipo;
  f.valor = p.valor === null || p.valor === undefined ? '' : String(p.valor);
  f.ofertaId = p.ofertaId ?? '';
  f.codigo = p.codigo ?? '';
  f.inicio = p.inicio;
  f.fin = p.fin;
  f.condiciones = p.condiciones ?? '';
  for (const t of p.textos) {
    f.titulo[t.idioma] = t.titulo;
    f.descripcion[t.idioma] = t.descripcion ?? '';
  }
  return f;
}

/** Errores por campo con las mismas reglas y claves que usa la API (`valor`, `codigo`, `fin`, `titulo.es`…). */
export function errorDePromo(f: FormPromo, hoy: string = hoyIso()): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.titulo['es']?.trim()) e['titulo.es'] = 'Escribe el título en español.';
  for (const [c, t] of Object.entries(f.titulo)) if (t.length > 100) e[`titulo.${c}`] = 'Máximo 100 caracteres.';
  for (const [c, t] of Object.entries(f.descripcion)) if (t.length > 500) e[`descripcion.${c}`] = 'Máximo 500 caracteres.';
  if (!f.titulo['en']?.trim() && f.descripcion['en']?.trim()) e['titulo.en'] = 'Si escribes en inglés, agrega también el título.';
  if (f.condiciones.length > 500) e['condiciones'] = 'Máximo 500 caracteres.';
  const codigo = f.codigo.trim();
  if (codigo && !/^[A-Za-z0-9_-]{3,30}$/.test(codigo)) e['codigo'] = 'Letras, números, guion y guion bajo (3 a 30).';
  if (usaValor(f.tipo)) {
    const v = aNumero(f.valor);
    if (v === null) e['valor'] = f.tipo === 'descuento_pct' ? 'Indica el porcentaje (de 1 a 100).' : 'Indica de cuánto es el descuento.';
    else if (f.tipo === 'descuento_pct' && (v < 1 || v > 100)) e['valor'] = 'Entre 1 y 100.';
    else if (v <= 0) e['valor'] = 'Debe ser mayor que cero.';
  }
  if (!f.inicio) e['inicio'] = 'Indica cuándo empieza.';
  if (!f.fin) e['fin'] = 'Indica cuándo termina.';
  if (f.inicio && f.fin) {
    if (f.fin < f.inicio) e['fin'] = 'Debe ser igual o posterior al inicio.';
    else if (f.fin < hoy) e['fin'] = 'Elige fechas de hoy en adelante.';
    else if (diasEntre(f.inicio, f.fin) > MAX_DIAS_PROMO) e['fin'] = 'Acorta el periodo (máximo un año).';
  }
  return e;
}

/** Cuerpo para la API: el valor solo viaja en los descuentos (los dos por uno y los regalos no lo admiten). */
export function promoParaApi(f: FormPromo): PromocionEntrada {
  const textos = Object.keys(f.titulo)
    .filter((c) => f.titulo[c].trim())
    .map((c) => ({ idioma: c, titulo: f.titulo[c].trim(), descripcion: vacioANull(f.descripcion[c]) }));
  return {
    ofertaId: f.ofertaId || null,
    tipo: f.tipo,
    valor: usaValor(f.tipo) ? aNumero(f.valor) : null,
    codigo: vacioANull(f.codigo),
    inicio: f.inicio,
    fin: f.fin,
    condiciones: vacioANull(f.condiciones),
    textos,
  };
}

/** ¿Se puede mandar a revisión desde aquí? Borrador y que no haya terminado; lo demás lo decide la API. */
export function puedeEnviarPromo(p: Promocion, hoy: string = hoyIso()): boolean {
  return p.estado === 'borrador' && p.fin >= hoy;
}

// ---------------- plan, suscripción y pagos ----------------

export function estadoSuscripcion(e: string): { texto: string; clase: string } {
  switch (e) {
    case 'activa': return { texto: 'Activa', clase: 'activa' };
    case 'gracia': return { texto: 'En gracia', clase: 'en_revision' };
    case 'vencida': return { texto: 'Vencida', clase: 'borrador' };
    case 'cancelada': return { texto: 'Cancelada', clase: 'cancelada' };
    default: return { texto: e, clase: 'borrador' };
  }
}

export function estadoPago(e: string): { texto: string; clase: string } {
  switch (e) {
    case 'pagado': return { texto: 'Pagado', clase: 'activa' };
    case 'pendiente': return { texto: 'Pendiente', clase: 'en_revision' };
    case 'fallido': return { texto: 'Fallido', clase: 'cancelada' };
    case 'reembolsado': return { texto: 'Reembolsado', clase: 'vencida' };
    default: return { texto: e, clase: 'borrador' };
  }
}

export const metodoTexto = (m: string): string =>
  ({ transferencia: 'Transferencia', enlace_pago: 'Enlace de pago', tarjeta: 'Tarjeta', efectivo: 'Efectivo' } as Record<string, string>)[m] ?? m;

export const conceptoTexto = (c: string, plan?: string | null): string =>
  c === 'suscripcion' ? (plan ? `Suscripción ${plan}` : 'Suscripción') : ({ patrocinio: 'Patrocinio', reserva: 'Reserva', otro: 'Otro' } as Record<string, string>)[c] ?? c;

export const periodoPlanTexto = (p: string | null | undefined): string => (p === 'anual' ? 'anual' : p === 'mensual' ? 'mensual' : (p ?? ''));

export function dinero(n: number | null | undefined, moneda = 'MXN'): string {
  if (n === null || n === undefined) return '';
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${moneda && moneda !== 'MXN' ? ' ' + moneda : ''}`;
}

/** Precio general (sin destino ni categoría) y vigente hoy de un plan para un periodo; null si no hay. */
export function precioGeneral(plan: PlanPublico, periodo: 'mensual' | 'anual', hoy: string = hoyIso()): PrecioPlan | null {
  return (plan.precios ?? []).find((p) => p.periodo === periodo && !p.destinoId && !p.categoriaId && (!p.vigenteDesde || p.vigenteDesde <= hoy) && (!p.vigenteHasta || p.vigenteHasta >= hoy)) ?? null;
}

export function usoPorcentaje(usado: number, limite: number): number {
  return limite <= 0 ? 0 : Math.min(100, Math.round((100 * usado) / limite));
}

export function diasTexto(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  if (n < 0) return 'ya venció';
  if (n === 0) return 'vence hoy';
  return n === 1 ? 'te queda 1 día' : `te quedan ${n} días`;
}

/** Cómo mostrar el contacto para cambiar de plan: WhatsApp, enlace o solo texto. Vacío = null. */
export function contactoEnlace(valor: string | null | undefined): { texto: string; href: string | null } | null {
  const v = (valor ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return { texto: 'Escríbenos', href: v };
  const digitos = v.replace(/\D/g, '');
  if (/^\+?[\d\s()-]{10,}$/.test(v) && digitos.length >= 10) return { texto: v, href: `https://wa.me/${digitos.length === 10 ? '52' + digitos : digitos}` };
  return { texto: v, href: null };
}

// ---------------- equipo ----------------

export const rolMiembroTexto = (r: string): string => (r === 'propietario' ? 'Propietario' : r === 'colaborador' ? 'Colaborador' : r);

export function estadoMiembro(e: string): { texto: string; clase: string } {
  return e === 'invitada' ? { texto: 'Invitada', clase: 'en_revision' } : e === 'activa' ? { texto: 'Activo', clase: 'activa' } : { texto: e, clase: 'borrador' };
}

export function inicialesDe(m: Pick<Miembro, 'nombre' | 'correo'>): string {
  const nombre = (m.nombre ?? '').trim();
  if (!nombre) return (m.correo.trim()[0] ?? '?').toUpperCase();
  const partes = nombre.split(/\s+/);
  return (partes[0][0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();
}

/** Propietario primero; luego activos y, al final, invitaciones. Las revocadas no se muestran. */
export function miembrosVisibles(lista: Miembro[]): Miembro[] {
  const rango = (m: Miembro): number => (m.rol === 'propietario' ? 0 : m.estado === 'activa' ? 1 : 2);
  return lista.filter((m) => m.estado !== 'revocada').sort((a, b) => rango(a) - rango(b) || (a.creadoEn ?? '').localeCompare(b.creadoEn ?? ''));
}

export function errorDeCorreo(c: string): string | null {
  const v = c.trim();
  if (!v) return 'Escribe el correo.';
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : 'Escribe un correo válido.';
}

// Re-exportados para las pruebas
export type { Pago, Suscripcion };
