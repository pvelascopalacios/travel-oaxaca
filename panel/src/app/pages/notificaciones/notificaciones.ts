import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Notificacion, Plantilla } from '../../core/modelos';
import { ESTADOS_COLA, estadoCola, puedeReintentar } from '../../core/operacion';
import { ErrorApi, fechaHora, leerError } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { enlazarAviso } from '../../core/avisos';

/** Cola de mensajes salientes. Solo administración: se pueden reintentar los que fallaron. */
@Component({
  selector: 'app-notificaciones',
  imports: [FormsModule],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.scss',
})
export class Notificaciones implements OnInit {
  private readonly api = inject(Api);
  private readonly pendientes = inject(Pendientes);
  protected readonly estados = ESTADOS_COLA;
  protected readonly estadoInfo = estadoCola;
  protected readonly puedeReintentar = puedeReintentar;
  protected readonly cuando = fechaHora;
  protected estado = '';
  protected plantilla = '';
  protected readonly pagina = signal(0);
  protected readonly plantillas = signal<Plantilla[]>([]);
  protected readonly datos = signal<{ elementos: Notificacion[]; total: number; tamano: number } | null>(null);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly errorItem = signal<{ id: string; texto: string } | null>(null);
  protected readonly paginas = computed(() => { const d = this.datos(); return d ? Math.max(1, Math.ceil(d.total / d.tamano)) : 1; });

  ngOnInit(): void {
    this.api.plantillas().subscribe({ next: (l) => this.plantillas.set(l), error: () => undefined });
    this.cargar();
  }

  protected filtrar(): void { this.pagina.set(0); this.cargar(); }
  protected ir(p: number): void { this.pagina.set(p); this.cargar(); }
  protected porEstado(e: string): void { this.estado = e; this.filtrar(); }

  protected cargar(): void {
    this.fallo.set(null);
    this.api.notificaciones({ estado: this.estado, plantilla: this.plantilla, pagina: this.pagina() }).subscribe({
      next: (p) => this.datos.set({ elementos: p.elementos, total: p.total, tamano: p.tamano }),
      error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar la cola.')),
    });
  }

  protected reintentar(n: Notificacion): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorItem.set(null);
    this.trabajando.set(n.id);
    this.api.reintentarNotificacion(n.id).subscribe({
      next: (r) => { this.trabajando.set(null); this.aviso.set(r.mensajes?.[0] ?? 'Quedó en la cola para reintentarse.'); this.cargar(); this.pendientes.refrescarFallidas(); },
      error: (e) => { this.trabajando.set(null); this.errorItem.set({ id: n.id, texto: leerError(e).general ?? 'No pudimos completar esto.' }); },
    });
  }
}
