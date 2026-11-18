import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ESTADOS_SOLICITUD, TransicionSolicitud, estadoSolicitud, tipoSolicitudTexto, transicionesDe } from '../../core/comunidad';
import { SolicitudPrivacidad } from '../../core/modelos';
import { ErrorApi, esperaTexto, fechaHora, leerError } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { enlazarAviso } from '../../core/avisos';

/** Solicitudes ARCO (acceso, rectificación, cancelación, oposición). Solo administración. */
@Component({
  selector: 'app-privacidad',
  imports: [RouterLink],
  templateUrl: './privacidad.html',
  styleUrl: './privacidad.scss',
})
export class Privacidad {
  /** /privacidad?estado=recibida&pagina=2 */
  readonly estado = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);

  protected readonly estados = ESTADOS_SOLICITUD;
  protected readonly filas = signal<SolicitudPrivacidad[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly errorItem = signal<{ id: string; texto: string } | null>(null);
  /** Solicitud y cierre a confirmar (resolver o rechazar). */
  protected readonly confirmando = signal<{ id: string; t: TransicionSolicitud } | null>(null);
  protected readonly conteos = signal<Record<string, number>>({});

  protected readonly estadoInfo = estadoSolicitud;
  protected readonly tipoTexto = tipoSolicitudTexto;
  protected readonly transiciones = transicionesDe;
  protected readonly fechaHora = fechaHora;
  protected readonly estadoActual = computed(() => (this.estados.some((e) => e.clave === this.estado()) ? this.estado()! : ''));
  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  constructor() {
    effect(() => {
      this.estado();
      this.pagina();
      this.cargar();
    });
    this.contar();
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { estado: this.estadoActual() || null, pagina: null, ...extra };
  }

  protected espera(s: SolicitudPrivacidad): string {
    return esperaTexto((Date.now() - new Date(s.creadoEn).getTime()) / 3600000);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.solicitudes({ estado: this.estadoActual() || null, pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar las solicitudes. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  private contar(): void {
    for (const e of this.estados) {
      this.api.solicitudes({ estado: e.clave, tamano: 1 }).subscribe({
        next: (p) => {
          this.conteos.update((c) => ({ ...c, [e.clave]: p.total }));
          if (e.clave === 'recibida') this.pendientes.privacidad.set(p.total);
        },
        error: () => undefined,
      });
    }
  }

  protected elegir(s: SolicitudPrivacidad, t: TransicionSolicitud): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorItem.set(null);
    if (t.cierra) { this.confirmando.set({ id: s.id, t }); return; }
    this.cambiar(s, t.estado);
  }

  protected cambiar(s: SolicitudPrivacidad, estado: string): void {
    this.trabajando.set(s.id);
    this.api.cambiarEstadoSolicitud(s.id, estado).subscribe({
      next: (r) => {
        this.trabajando.set(null);
        this.confirmando.set(null);
        this.aviso.set(r.mensajes?.[0] ?? 'Solicitud actualizada.');
        this.cargar();
        this.contar();
      },
      error: (e) => {
        this.trabajando.set(null);
        this.confirmando.set(null);
        this.errorItem.set({ id: s.id, texto: leerError(e).general ?? 'No se pudo actualizar.' });
        if (e?.status === 409) { this.cargar(); this.contar(); }
      },
    });
  }
}
