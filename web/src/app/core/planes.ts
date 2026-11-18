import { PlanPublico, PrecioPlan } from './modelos';

export type Periodo = 'anual' | 'mensual';

/** Los planes en el orden en que se muestran: del que menos incluye al que más. */
export function ordenarPlanes(planes: PlanPublico[]): PlanPublico[] {
  const puntos = (p: PlanPublico) => p.limiteFotos + p.limiteOfertas * 2 + (p.veEstadisticas ? 5 : 0) + (p.permitePatrocinio ? 20 : 0);
  return [...planes].sort((a, b) => puntos(a) - puntos(b));
}

/** Periodos con precio en al menos un plan de pago; el anual primero. */
export function periodosDisponibles(planes: PlanPublico[]): Periodo[] {
  const hay = (p: Periodo) => planes.some((x) => x.precios.some((r) => r.periodo === p));
  return (['anual', 'mensual'] as Periodo[]).filter(hay);
}

export interface PrecioVisible {
  monto: number;
  moneda: string;
  /** Cuando solo hay precios específicos por categoría o destino, se muestra «desde». */
  desde: boolean;
}

/**
 * Precio que se muestra en la tarjeta del plan. Gana el precio general (sin destino ni categoría);
 * si solo hay precios específicos se muestra el más bajo con «desde». Sin precios: null.
 */
export function precioVisible(plan: Pick<PlanPublico, 'precios'>, periodo: Periodo): PrecioVisible | null {
  const delPeriodo = plan.precios.filter((p) => p.periodo === periodo);
  if (!delPeriodo.length) return null;
  const general = delPeriodo.find((p: PrecioPlan) => !p.destinoId && !p.categoriaId);
  if (general) return { monto: general.monto, moneda: general.moneda, desde: false };
  const menor = delPeriodo.reduce((a, b) => (b.monto < a.monto ? b : a));
  return { monto: menor.monto, moneda: menor.moneda, desde: true };
}

/** Un plan sin ningún precio publicado es el gratuito (o uno que aún no tiene precio). */
export const esGratis = (plan: Pick<PlanPublico, 'clave' | 'precios'>): boolean => plan.clave === 'gratis';

/** Dirección del portal para registrarse o entrar, con el idioma de la web. */
export function enlacePortal(portal: string, modo: 'registro' | 'ingreso'): string {
  const base = portal.replace(/\/+$/, '');
  const q = new URLSearchParams();
  if (modo === 'registro') q.set('modo', 'registro');
  const s = q.toString();
  return `${base}/ingresar${s ? '?' + s : ''}`;
}
