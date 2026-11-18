import { ActivarEntrada, Categoria, Cupon, CuponEdicion, CuponEntrada, Destino, Pago, Plan, PlanEdicion, Precio, PrecioEntrada, Suscripcion, VerificacionEntrada } from './modelos';
import { Info } from './panel';

// ---------------- números y fechas ----------------

const dos = (n: number): string => String(n).padStart(2, '0');

export function hoyIso(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** «1234.5» o «1,234.50» → 1234.5; vacío o no numérico → null. */
export function aNumero(t: string | number | null | undefined): number | null {
  if (t === null || t === undefined) return null;
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const s = t.trim().replace(/[$\s,]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const vacioANull = (t: string | null | undefined): string | null => {
  const v = (t ?? '').trim();
  return v ? v : null;
};

export function dinero(n: number | null | undefined, moneda = 'MXN'): string {
  if (n === null || n === undefined) return '—';
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${moneda && moneda !== 'MXN' ? ' ' + moneda : ''}`;
}

export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

export function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000);
}

/** Suma meses o años como Java `plusMonths`/`plusYears`: si el día no existe, queda el último del mes (31 ene + 1 mes = 28 feb). */
export function sumarPeriodo(desde: string, periodo: string, cantidad = 1): string {
  const [a, m, d] = desde.split('-').map(Number);
  const meses = periodo === 'anual' ? 12 * cantidad : cantidad;
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(anio, mes, 0).getDate();
  return `${anio}-${dos(mes)}-${dos(Math.min(d, ultimo))}`;
}

// ---------------- estados y textos ----------------

export function estadoNegocioInfo(e: string): Info {
  switch (e) {
    case 'publicada': return { texto: 'Publicada', clase: 'publicada' };
    case 'en_revision': return { texto: 'En revisión', clase: 'en_revision' };
    case 'pausada': return { texto: 'Pausada', clase: 'pausada' };
    case 'archivada': return { texto: 'Archivada', clase: 'archivada' };
    default: return { texto: 'Borrador', clase: 'borrador' };
  }
}

export const ESTADOS_NEGOCIO = ['publicada', 'en_revision', 'borrador', 'pausada', 'archivada'];

export function estadoSuscripcion(e: string): Info {
  switch (e) {
    case 'activa': return { texto: 'Activa', clase: 'ok' };
    case 'gracia': return { texto: 'En gracia', clase: 'cambio' };
    case 'cancelada': return { texto: 'Cancelada', clase: 'mal' };
    default: return { texto: 'Vencida', clase: 'gris' };
  }
}

export function estadoPago(e: string): Info {
  switch (e) {
    case 'pagado': return { texto: 'Pagado', clase: 'ok' };
    case 'pendiente': return { texto: 'Pendiente', clase: 'cambio' };
    case 'fallido': return { texto: 'Fallido', clase: 'mal' };
    case 'reembolsado': return { texto: 'Reembolsado', clase: 'gris' };
    default: return { texto: e, clase: 'gris' };
  }
}

export const metodoTexto = (m: string): string =>
  ({ transferencia: 'Transferencia', enlace_pago: 'Enlace de pago', tarjeta: 'Tarjeta', efectivo: 'Efectivo' } as Record<string, string>)[m] ?? m;

export const conceptoTexto = (c: string): string =>
  ({ suscripcion: 'Suscripción', patrocinio: 'Patrocinio', reserva: 'Reserva', otro: 'Otro' } as Record<string, string>)[c] ?? c;

export const origenTexto = (o: string | null | undefined): string =>
  !o ? '—' : ({ portal: 'Portal', importacion: 'Importación', admin: 'Equipo', prospecto: 'Prospecto' } as Record<string, string>)[o] ?? o.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());

export const periodoTexto = (p: string | null | undefined): string => (p === 'anual' ? 'anual' : p === 'mensual' ? 'mensual' : (p ?? ''));

export function diasTexto(n: number): string {
  if (n < 0) return 'ya venció';
  if (n === 0) return 'vence hoy';
  return n === 1 ? 'queda 1 día' : `quedan ${n} días`;
}

// ---------------- suscripción vigente ----------------

/** La suscripción que rige hoy: la activa o en gracia con fecha final más lejana. */
export function suscripcionVigente(l: Suscripcion[]): Suscripcion | null {
  return [...l].filter((s) => s.estado === 'activa' || s.estado === 'gracia').sort((a, b) => b.fin.localeCompare(a.fin))[0] ?? null;
}

export const ordenarSuscripciones = (l: Suscripcion[]): Suscripcion[] => [...l].sort((a, b) => b.inicio.localeCompare(a.inicio) || b.fin.localeCompare(a.fin));

// ---------------- activar o renovar ----------------

export interface FormActivar {
  planClave: string;
  periodo: string;
  monto: string;
  cupon: string;
  metodo: string;
  referencia: string;
  pagado: boolean;
}

export const formActivarVacio = (): FormActivar => ({ planClave: '', periodo: 'anual', monto: '', cupon: '', metodo: 'transferencia', referencia: '', pagado: true });

export interface Cobro {
  base: number | null;
  total: number | null;
  periodos: number;
  gratis: boolean;
  origen: 'monto' | 'catalogo' | null;
}

/** Lo que cobraría la API: monto escrito o precio del catálogo, menos el cupón. Sin ninguno de los dos, no hay cálculo. */
export function calcularCobro(montoEscrito: number | null, precioCatalogo: number | null, cupon: Cupon | null): Cobro {
  const base = montoEscrito ?? precioCatalogo;
  const origen = montoEscrito !== null ? 'monto' : precioCatalogo !== null ? 'catalogo' : null;
  if (base === null) return { base: null, total: null, periodos: 1, gratis: false, origen: null };
  let total = base;
  let periodos = 1;
  if (cupon) {
    if (cupon.tipo === 'pct') total = (base * (100 - cupon.valor)) / 100;
    else if (cupon.tipo === 'monto') total = Math.max(0, base - cupon.valor);
    else if (cupon.tipo === 'periodo_gratis') {
      periodos = Math.max(1, Math.floor(cupon.valor));
      total = 0;
    }
  }
  total = Math.round(total * 100) / 100;
  return { base, total, periodos, gratis: total === 0, origen };
}

/** Fecha en que quedaría vigente: si es el mismo plan, desde donde termina; si no, desde hoy. */
export function vigenciaNueva(vigente: Suscripcion | null, planClave: string, periodo: string, periodos: number, hoy: string): { desde: string; hasta: string; extiende: boolean } {
  const extiende = !!vigente && vigente.planClave === planClave;
  const desde = extiende && vigente!.fin > hoy ? vigente!.fin : hoy;
  return { desde: extiende ? desde : hoy, hasta: sumarPeriodo(desde, periodo, periodos), extiende };
}

export function errorDeActivar(f: FormActivar, cobro: Cobro): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.planClave) e['planClave'] = 'Elige el plan.';
  if (f.monto.trim() && (aNumero(f.monto) === null || (aNumero(f.monto) ?? 0) < 0)) e['monto'] = 'Escribe un monto válido (0 o más).';
  if (f.referencia.length > 100) e['referencia'] = 'Máximo 100 caracteres.';
  if (f.cupon.trim() && !/^[A-Za-z0-9_-]{1,30}$/.test(f.cupon.trim())) e['cupon'] = 'Letras, números, guion y guion bajo.';
  if (cobro.total !== null && cobro.total > 0 && !f.metodo) e['metodo'] = 'Indica cómo pagó el negocio.';
  return e;
}

export function activarParaApi(f: FormActivar, cobro: Cobro): ActivarEntrada {
  const cobra = cobro.total === null || cobro.total > 0;
  return {
    planClave: f.planClave,
    periodo: f.periodo,
    cupon: vacioANull(f.cupon),
    monto: aNumero(f.monto),
    pagado: f.pagado,
    metodo: cobra ? f.metodo || null : null,
    referencia: vacioANull(f.referencia),
  };
}

// ---------------- otro cobro ----------------

export interface FormCobro {
  monto: string;
  metodo: string;
  referencia: string;
  pagado: boolean;
}
export const formCobroVacio = (): FormCobro => ({ monto: '', metodo: 'transferencia', referencia: '', pagado: true });

export function errorDeCobro(f: FormCobro, negocioId: string | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (!negocioId) e['negocioId'] = 'Elige el negocio.';
  const m = aNumero(f.monto);
  if (m === null) e['monto'] = 'Escribe el monto.';
  else if (m < 0) e['monto'] = 'El monto no puede ser negativo.';
  if (f.referencia.length > 100) e['referencia'] = 'Máximo 100 caracteres.';
  return e;
}

// ---------------- pagos pendientes ----------------

export const accionesDePago = (estado: string): { estado: string; texto: string; peligro: boolean }[] => {
  switch (estado) {
    case 'pendiente': return [{ estado: 'pagado', texto: 'Confirmar', peligro: false }, { estado: 'fallido', texto: 'Fallido', peligro: true }];
    case 'pagado': return [{ estado: 'reembolsado', texto: 'Reembolsar', peligro: true }];
    case 'fallido': return [{ estado: 'pagado', texto: 'Marcar pagado', peligro: false }];
    default: return [];
  }
};

export const ordenarPagos = (l: Pago[]): Pago[] => [...l].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));

// ---------------- verificación ----------------

export const METODOS_VERIFICACION = [
  { clave: 'llamada', texto: 'Llamada' },
  { clave: 'whatsapp', texto: 'WhatsApp' },
  { clave: 'visita', texto: 'Visita' },
  { clave: 'documento', texto: 'Documento' },
];
export const metodoVerificacionTexto = (m: string): string => METODOS_VERIFICACION.find((x) => x.clave === m)?.texto ?? m;

export interface FormVerificacion {
  metodo: string;
  resultado: string;
  notas: string;
  vigenteHasta: string;
}
export const formVerificacionVacio = (): FormVerificacion => ({ metodo: 'llamada', resultado: 'aprobada', notas: '', vigenteHasta: '' });

export function errorDeVerificacion(f: FormVerificacion, hoy: string = hoyIso()): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.notas.length > 500) e['notas'] = 'Máximo 500 caracteres.';
  if (f.vigenteHasta && f.vigenteHasta < hoy) e['vigenteHasta'] = 'Elige una fecha de hoy en adelante.';
  return e;
}

/** La API recibe fecha y hora; la vigencia termina al final del día elegido. */
export function verificacionParaApi(f: FormVerificacion): VerificacionEntrada {
  return { metodo: f.metodo, resultado: f.resultado, notas: vacioANull(f.notas), vigenteHasta: f.vigenteHasta ? `${f.vigenteHasta}T23:59:59-06:00` : null };
}

/** Verificada hoy: la última aprobada que no ha vencido, siempre que no haya una rechazada más reciente. */
export function verificacionVigente<T extends { resultado: string; fecha: string; vigenteHasta: string | null }>(l: T[], ahora: Date = new Date()): T | null {
  const orden = [...l].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultima = orden[0];
  if (!ultima || ultima.resultado !== 'aprobada') return null;
  return ultima.vigenteHasta && new Date(ultima.vigenteHasta) < ahora ? null : ultima;
}

// ---------------- planes ----------------

export interface FormPlan {
  nombre: string;
  limiteFotos: string;
  limiteOfertas: string;
  veEstadisticas: boolean;
  permitePromociones: boolean;
  permitePatrocinio: boolean;
  activo: boolean;
}

export const formDePlan = (p: Plan): FormPlan => ({ nombre: p.nombre, limiteFotos: String(p.limiteFotos), limiteOfertas: String(p.limiteOfertas), veEstadisticas: p.veEstadisticas, permitePromociones: p.permitePromociones, permitePatrocinio: p.permitePatrocinio, activo: p.activo });

export function errorDePlan(f: FormPlan): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.nombre.trim()) e['nombre'] = 'Escribe el nombre del plan.';
  else if (f.nombre.length > 60) e['nombre'] = 'Máximo 60 caracteres.';
  const fotos = aNumero(f.limiteFotos);
  if (fotos === null || !Number.isInteger(fotos) || fotos < 1) e['limiteFotos'] = 'Al menos 1 foto (número entero).';
  const ofertas = aNumero(f.limiteOfertas);
  if (ofertas === null || !Number.isInteger(ofertas) || ofertas < 0) e['limiteOfertas'] = 'Un número entero, 0 o más.';
  return e;
}

export const planParaApi = (f: FormPlan, p: Plan): PlanEdicion => ({
  nombre: f.nombre.trim(),
  limiteFotos: aNumero(f.limiteFotos) ?? p.limiteFotos,
  limiteOfertas: aNumero(f.limiteOfertas) ?? p.limiteOfertas,
  veEstadisticas: f.veEstadisticas,
  permitePromociones: f.permitePromociones,
  permitePatrocinio: f.permitePatrocinio,
  activo: f.activo,
  orden: p.orden,
});

// ---------------- precios ----------------

export type EstadoPrecio = 'vigente' | 'futuro' | 'cerrado';

export function estadoPrecio(p: Pick<Precio, 'vigenteDesde' | 'vigenteHasta'>, hoy: string = hoyIso()): EstadoPrecio {
  if (p.vigenteHasta && p.vigenteHasta < hoy) return 'cerrado';
  return p.vigenteDesde > hoy ? 'futuro' : 'vigente';
}

export function nombreCategoriaPorId(arbol: Categoria[], id: string): string | null {
  for (const c of arbol) {
    if (c.id === id) return c.nombre;
    const h = nombreCategoriaPorId(c.hijas ?? [], id);
    if (h) return h;
  }
  return null;
}

/** Todas las categorías (grupos y hojas) con su ruta, para elegir a cuál aplica un precio. */
export function categoriasConRuta(arbol: Categoria[]): { id: string; etiqueta: string }[] {
  const salida: { id: string; etiqueta: string }[] = [];
  const recorrer = (c: Categoria, ruta: string) => {
    const etiqueta = ruta ? `${ruta} › ${c.nombre}` : c.nombre;
    salida.push({ id: c.id, etiqueta });
    (c.hijas ?? []).forEach((h) => recorrer(h, etiqueta));
  };
  arbol.forEach((c) => recorrer(c, ''));
  return salida;
}

export function alcancePrecio(p: Pick<Precio, 'destinoId' | 'categoriaId'>, destinos: Destino[], arbol: Categoria[]): string {
  const partes: string[] = [];
  if (p.destinoId) partes.push(destinos.find((d) => d.id === p.destinoId)?.nombre ?? 'Un destino');
  if (p.categoriaId) partes.push(nombreCategoriaPorId(arbol, p.categoriaId) ?? 'Una categoría');
  return partes.length ? partes.join(' · ') : 'General';
}

export interface FormPrecio {
  planId: string;
  periodo: string;
  monto: string;
  destinoId: string;
  categoriaId: string;
  vigenteDesde: string;
  vigenteHasta: string;
}
export const formPrecioVacio = (): FormPrecio => ({ planId: '', periodo: 'mensual', monto: '', destinoId: '', categoriaId: '', vigenteDesde: '', vigenteHasta: '' });

export function errorDePrecio(f: FormPrecio): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.planId) e['planId'] = 'Elige el plan.';
  const m = aNumero(f.monto);
  if (m === null) e['monto'] = 'Escribe el monto.';
  else if (m < 0) e['monto'] = 'El monto no puede ser negativo.';
  if (f.vigenteDesde && f.vigenteHasta && f.vigenteHasta < f.vigenteDesde) e['vigenteHasta'] = 'Debe ser igual o posterior al inicio.';
  return e;
}

export const precioParaApi = (f: FormPrecio): PrecioEntrada => ({
  planId: f.planId,
  destinoId: f.destinoId || null,
  categoriaId: f.categoriaId || null,
  periodo: f.periodo,
  monto: aNumero(f.monto) ?? 0,
  moneda: null,
  vigenteDesde: f.vigenteDesde || null,
  vigenteHasta: f.vigenteHasta || null,
});

/** Los precios más específicos primero, luego los generales; dentro de cada plan y periodo, el más reciente arriba. */
export function ordenarPrecios(l: Precio[], planes: Plan[]): Precio[] {
  const ordenPlan = (p: Precio) => planes.find((x) => x.id === p.planId)?.orden ?? 99;
  return [...l].sort((a, b) => ordenPlan(a) - ordenPlan(b) || a.periodo.localeCompare(b.periodo) || b.vigenteDesde.localeCompare(a.vigenteDesde));
}

// ---------------- cupones ----------------

export const TIPOS_CUPON = [
  { clave: 'pct', texto: 'Porcentaje' },
  { clave: 'monto', texto: 'Monto en pesos' },
  { clave: 'periodo_gratis', texto: 'Periodos gratis' },
];

export const tipoCuponTexto = (t: string): string => TIPOS_CUPON.find((x) => x.clave === t)?.texto ?? t;
export const aplicaATexto = (a: string): string => (a === 'patrocinio' ? 'Patrocinio' : 'Suscripción');

export function valorCuponTexto(c: Pick<Cupon, 'tipo' | 'valor'>): string {
  if (c.tipo === 'pct') return `${Number(c.valor)} %`;
  if (c.tipo === 'monto') return dinero(c.valor);
  return `${Number(c.valor)} ${Number(c.valor) === 1 ? 'periodo' : 'periodos'}`;
}

export function cuponVigente(c: Pick<Cupon, 'vigenteDesde' | 'vigenteHasta' | 'maxUsos' | 'usos'>, hoy: string = hoyIso()): boolean {
  return (!c.vigenteDesde || c.vigenteDesde <= hoy) && (!c.vigenteHasta || c.vigenteHasta >= hoy) && (c.maxUsos === null || c.maxUsos === undefined || c.usos < c.maxUsos);
}

export interface FormCupon {
  codigo: string;
  descripcion: string;
  tipo: string;
  valor: string;
  aplicaA: string;
  maxUsos: string;
  vigenteDesde: string;
  vigenteHasta: string;
}
export const formCuponVacio = (): FormCupon => ({ codigo: '', descripcion: '', tipo: 'pct', valor: '', aplicaA: 'suscripcion', maxUsos: '', vigenteDesde: '', vigenteHasta: '' });

export const formDeCupon = (c: Cupon): FormCupon => ({ codigo: c.codigo, descripcion: c.descripcion ?? '', tipo: c.tipo, valor: String(c.valor), aplicaA: c.aplicaA, maxUsos: c.maxUsos === null || c.maxUsos === undefined ? '' : String(c.maxUsos), vigenteDesde: c.vigenteDesde ?? '', vigenteHasta: c.vigenteHasta ?? '' });

export function errorDeCupon(f: FormCupon, usos = 0): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(f.codigo.trim())) e['codigo'] = 'Letras, números, guion y guion bajo (3 a 30).';
  if (f.descripcion.length > 200) e['descripcion'] = 'Máximo 200 caracteres.';
  const v = aNumero(f.valor);
  if (v === null || v <= 0) e['valor'] = 'Debe ser mayor que cero.';
  else if (f.tipo === 'pct' && v > 100) e['valor'] = 'El porcentaje va de 1 a 100.';
  else if (f.tipo === 'periodo_gratis' && !Number.isInteger(v)) e['valor'] = 'Un número entero de periodos.';
  if (f.maxUsos.trim()) {
    const m = aNumero(f.maxUsos);
    if (m === null || !Number.isInteger(m) || m < 1) e['maxUsos'] = 'Al menos 1 uso (número entero).';
    else if (m < usos) e['maxUsos'] = `Ya se usó ${usos} veces; el máximo no puede ser menor.`;
  }
  if (f.vigenteDesde && f.vigenteHasta && f.vigenteHasta < f.vigenteDesde) e['vigenteHasta'] = 'Debe ser igual o posterior al inicio.';
  return e;
}

export const cuponParaApi = (f: FormCupon): CuponEntrada => ({
  codigo: f.codigo.trim(),
  descripcion: vacioANull(f.descripcion),
  tipo: f.tipo,
  valor: aNumero(f.valor) ?? 0,
  aplicaA: f.aplicaA,
  maxUsos: f.maxUsos.trim() ? aNumero(f.maxUsos) : null,
  vigenteDesde: f.vigenteDesde || null,
  vigenteHasta: f.vigenteHasta || null,
});

export const cuponEdicionParaApi = (f: FormCupon): CuponEdicion => ({ descripcion: vacioANull(f.descripcion), maxUsos: f.maxUsos.trim() ? aNumero(f.maxUsos) : null, vigenteHasta: f.vigenteHasta || null });
