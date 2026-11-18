import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api';

/** Cuántas solicitudes esperan revisión (para el menú y las pestañas) y el último aviso de una decisión. */
@Injectable({ providedIn: 'root' })
export class Pendientes {
  private readonly api = inject(Api);
  readonly fichas = signal<number | null>(null);
  readonly cambios = signal<number | null>(null);
  readonly fotos = signal<number | null>(null);
  readonly promociones = signal<number | null>(null);
  /** Elementos de la cola de comunidad (editor y admin). */
  readonly comunidad = signal<number | null>(null);
  /** Solicitudes de privacidad recibidas (solo admin). */
  readonly privacidad = signal<number | null>(null);
  /** Prospectos con la próxima acción vencida (ventas y admin). */
  readonly prospectos = signal<number | null>(null);
  /** Notificaciones fallidas (solo admin). */
  readonly fallidas = signal<number | null>(null);
  /** Pagos por confirmar (admin y ventas). */
  readonly pagos = signal<number | null>(null);
  readonly total = computed(() => (this.fichas() ?? 0) + (this.cambios() ?? 0) + (this.fotos() ?? 0) + (this.promociones() ?? 0));
  readonly cargado = computed(() => [this.fichas(), this.cambios(), this.fotos(), this.promociones()].some((x) => x !== null));
  /** Mensaje de la última decisión; la cola lo muestra una vez. */
  readonly aviso = signal<string | null>(null);

  /** Pide los cuatro totales. Si alguno falla, ese queda sin dato y el resto se muestra. */
  refrescar(): void {
    const t = (tipo: string, destino: typeof this.fichas) =>
      this.api.cola({ tipo, tamano: 1 }).subscribe({ next: (p) => destino.set(p.total), error: () => undefined });
    t('ficha_nueva', this.fichas);
    t('cambio', this.cambios);
    t('foto', this.fotos);
    this.api.colaPromociones(0, 1).subscribe({ next: (p) => this.promociones.set(p.total), error: () => undefined });
  }

  refrescarPagos(): void {
    this.api.pagosPendientes().subscribe({ next: (l) => this.pagos.set(l.length), error: () => undefined });
  }

  refrescarComunidad(): void {
    this.api.colaComunidad({ tamano: 1 }).subscribe({ next: (p) => this.comunidad.set(p.total), error: () => undefined });
  }

  refrescarPrivacidad(): void {
    this.api.solicitudes({ estado: 'recibida', tamano: 1 }).subscribe({ next: (p) => this.privacidad.set(p.total), error: () => undefined });
  }

  refrescarProspectos(): void {
    this.api.resumenVentas().subscribe({ next: (r) => this.prospectos.set(r.vencidas), error: () => undefined });
  }

  refrescarFallidas(): void {
    this.api.notificaciones({ estado: 'fallida', tamano: 1 }).subscribe({ next: (r) => this.fallidas.set(r.total), error: () => undefined });
  }
}
