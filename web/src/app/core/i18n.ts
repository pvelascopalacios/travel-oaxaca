import { Injectable, signal } from '@angular/core';
import { Idioma, IDIOMAS } from './config';
import { Clave, TEXTOS } from './textos';

/** Idioma activo (lo fija el prefijo /es o /en de la dirección) y traducción de los textos de la interfaz. */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Idioma>('es');

  fijar(idioma: string): void {
    if ((IDIOMAS as readonly string[]).includes(idioma)) this.lang.set(idioma as Idioma);
  }

  t(clave: Clave): string {
    return TEXTOS[this.lang()][clave];
  }

  /** Texto con huecos {n}: tf('verNResultados', { n: 12 }). */
  tf(clave: Clave, valores: Record<string, string | number>): string {
    return this.t(clave).replace(/\{(\w+)\}/g, (_m, k: string) => String(valores[k] ?? ''));
  }

  /** Texto con clave armada (por ejemplo, tipo_playa). Si no existe, regresa la clave sin prefijo. */
  tDinamico(prefijo: string, valor: string | null | undefined): string {
    if (!valor) return '';
    const clave = `${prefijo}_${valor}` as Clave;
    return TEXTOS[this.lang()][clave] ?? valor;
  }

  fecha(iso: string, opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
    return new Intl.DateTimeFormat(this.lang() === 'es' ? 'es-MX' : 'en-US', { timeZone: 'UTC', ...opciones }).format(
      new Date(iso + 'T00:00:00Z'),
    );
  }

  precio(monto: number, moneda: string | null): string {
    return new Intl.NumberFormat(this.lang() === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: moneda ?? 'MXN',
      maximumFractionDigits: 0,
    }).format(monto);
  }
}
