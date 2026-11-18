import { HttpErrorResponse } from '@angular/common/http';
import { Contacto, ExcepcionHorario, Horario } from './modelos';

/** La API respondió 404: la ficha no existe (o ya no está publicada). Un tropiezo de red no cuenta. */
export function esNoEncontrado(e: unknown): boolean {
  return e instanceof HttpErrorResponse && e.status === 404;
}

/** Solo deja pasar direcciones http(s); cualquier otra cosa se descarta. */
export function urlSegura(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return 'https://' + t;
  return null;
}

export interface EnlaceContacto {
  tipo: Contacto['tipo'];
  texto: string;
  href: string;
}

const REDES: Record<string, string> = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/@',
};

/** Convierte un contacto de la API en un enlace que se puede tocar. Si el valor no sirve, regresa null. */
export function enlaceDeContacto(c: Contacto): EnlaceContacto | null {
  const v = (c.valor ?? '').trim();
  if (!v) return null;
  switch (c.tipo) {
    case 'whatsapp': {
      const d = v.replace(/\D/g, '');
      return d.length >= 8 ? { tipo: c.tipo, texto: v, href: 'https://wa.me/' + d } : null;
    }
    case 'telefono': {
      const d = v.replace(/[^\d+]/g, '');
      return d.length >= 7 ? { tipo: c.tipo, texto: v, href: 'tel:' + d } : null;
    }
    case 'correo':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { tipo: c.tipo, texto: v, href: 'mailto:' + v } : null;
    case 'web':
    case 'reservas_url': {
      const u = urlSegura(v);
      return u ? { tipo: c.tipo, texto: u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), href: u } : null;
    }
    default: {
      const u = urlSegura(v);
      if (u) return { tipo: c.tipo, texto: v, href: u };
      const usuario = v.replace(/^@/, '');
      return /^[\w.-]+$/.test(usuario) ? { tipo: c.tipo, texto: '@' + usuario, href: REDES[c.tipo] + usuario } : null;
    }
  }
}

/** Primer contacto utilizable de un tipo, prefiriendo el principal. */
export function primero(contactos: Contacto[], tipo: Contacto['tipo']): EnlaceContacto | null {
  const lista = contactos.filter((c) => c.tipo === tipo).sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal));
  for (const c of lista) {
    const e = enlaceDeContacto(c);
    if (e) return e;
  }
  return null;
}

export function comoLlegarUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** '09:30:00' → '09:30'. */
export function hhmm(h: string | null | undefined): string {
  return h ? h.slice(0, 5) : '';
}

export interface FilaHorario {
  dia: number;
  cerrado: boolean;
  tramos: string[];
}

/** Lunes primero. Un día con varios tramos (comida y cena) muestra todos; un día sin datos se marca cerrado. */
export function filasHorario(horarios: Horario[]): FilaHorario[] {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return orden.map((dia) => {
    const delDia = horarios.filter((h) => h.diaSemana === dia);
    const abiertos = delDia.filter((h) => !h.cerrado && h.abre && h.cierra);
    return {
      dia,
      cerrado: !abiertos.length,
      tramos: abiertos.map((h) => `${hhmm(h.abre)}–${hhmm(h.cierra)}`),
    };
  });
}

export function nombreDia(dia: number, lang: string): string {
  // 7 de enero de 2024 fue domingo.
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + dia)));
}

export function diaDeSemana(fechaIso: string): number {
  return new Date(fechaIso + 'T00:00:00Z').getUTCDay();
}

/** Excepciones que todavía no pasan, la más próxima primero. */
export function excepcionesVigentes(ex: ExcepcionHorario[], hoy: string): ExcepcionHorario[] {
  return ex.filter((e) => e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5);
}

/** Texto plano → párrafos; ignora líneas vacías. */
export function parrafos(t: string | null | undefined): string[] {
  return (t ?? '').split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
}

/** Enlace para Google Calendar de un evento de días completos (la fecha final es exclusiva en este formato). */
export function calendarioUrl(nombre: string, inicio: string, fin: string, lugar: string): string {
  const d = (iso: string) => iso.replace(/-/g, '');
  const sumar = new Date(new Date(fin + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: nombre, dates: `${d(inicio)}/${d(sumar)}`, location: lugar });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/** Calificación solo con 3 reseñas o más. */
export function calificacionVisible(prom: number | null, total: number): string | null {
  return prom !== null && total >= 3 ? prom.toFixed(1) : null;
}

/** El bloque de fecha de un evento: «20–22» y «NOV». mesCorto da el mes abreviado de una fecha ISO en el idioma de la página. */
export function bloqueDeFecha(inicio: string, fin: string | null | undefined, mesCorto: (iso: string) => string): { dias: string; mes: string } {
  const dia = (f: string) => String(Number(f.slice(8, 10)));
  const mes = (f: string) => mesCorto(f).replace('.', '').toUpperCase();
  const m1 = mes(inicio);
  if (!fin || fin === inicio) return { dias: dia(inicio), mes: m1 };
  const m2 = mes(fin);
  return { dias: `${dia(inicio)}–${dia(fin)}`, mes: m1 === m2 ? m1 : `${m1}–${m2}` };
}
