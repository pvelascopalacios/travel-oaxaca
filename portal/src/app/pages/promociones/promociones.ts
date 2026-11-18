import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { descripcionDe, estadoPromo, insignia, ordenarPromos, periodoTexto, puedeEnviarPromo, tipoPromoTexto, tituloDe, valorPromo } from '../../core/comercial';
import { Ficha, PlanNegocio, Promocion } from '../../core/modelos';
import { nombreDe } from '../../core/opciones';
import { ErrorApi, estadoInfo, leerError } from '../../core/portal';
import { FormPromocion, PromoGuardada } from './form-promocion';

/** Promociones del negocio: borradores, en revisión, activas y vencidas. */
@Component({
  selector: 'app-promociones',
  imports: [RouterLink, FormPromocion],
  templateUrl: './promociones.html',
  styleUrl: './promociones.scss',
})
export class Promociones implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(Api);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly plan = signal<PlanNegocio | null>(null);
  protected readonly promos = signal<Promocion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly editando = signal<{ promo: Promocion | null } | null>(null);
  protected readonly trabajandoId = signal<string | null>(null);
  protected readonly confirmandoId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly estado = estadoPromo;
  protected readonly tipoTexto = tipoPromoTexto;
  protected readonly titulo = tituloDe;
  protected readonly descripcion = descripcionDe;
  protected readonly valor = valorPromo;
  protected readonly insignia = insignia;
  protected readonly periodo = periodoTexto;
  protected readonly infoNegocio = estadoInfo;

  protected readonly lista = computed(() => ordenarPromos(this.promos()));
  protected readonly publicada = computed(() => this.ficha()?.estado === 'publicada');
  protected readonly sinPlan = computed(() => this.plan() !== null && !this.plan()?.plan.permitePromociones);
  protected readonly ofertasActivas = computed(() => (this.ficha()?.ofertas ?? []).filter((o) => o.estado !== 'archivada'));
  protected readonly nombreOferta = (id: string | null): string => {
    const o = (this.ficha()?.ofertas ?? []).find((x) => x.id === id);
    return o ? nombreDe(o) : '';
  };
  protected readonly soloLectura = computed(() => this.ficha()?.estado === 'archivada');
  protected readonly puedeEnviar = (p: Promocion): boolean => puedeEnviarPromo(p) && this.publicada();

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.ficha(this.id()).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar tu negocio. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
    this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
    this.api.promociones(this.id()).subscribe({
      next: (l) => this.promos.set(l),
      // Un plan sin promociones puede responder error al listar; la página lo explica con el candado.
      error: (e) => {
        if (!this.sinPlan()) this.error.set(leerError(e, 'No pudimos cargar las promociones.').general);
      },
    });
  }

  protected nueva(): void {
    this.aviso.set(null);
    this.error.set(null);
    this.editando.set({ promo: null });
  }

  protected cambiar(p: Promocion): void {
    this.aviso.set(null);
    this.error.set(null);
    this.confirmandoId.set(null);
    this.editando.set({ promo: p });
  }

  protected alGuardar(r: PromoGuardada): void {
    this.promos.update((l) => (l.some((x) => x.id === r.promo.id) ? l.map((x) => (x.id === r.promo.id ? r.promo : x)) : [...l, r.promo]));
    this.editando.set(null);
    this.aviso.set(r.aviso);
  }

  protected enviar(p: Promocion): void {
    if (this.trabajandoId()) return;
    this.error.set(null);
    this.aviso.set(null);
    this.trabajandoId.set(p.id);
    this.api.enviarPromocion(this.id(), p.id).subscribe({
      next: (r) => {
        this.promos.update((l) => l.map((x) => (x.id === p.id ? r.datos : x)));
        this.trabajandoId.set(null);
        this.aviso.set('Enviada a revisión. Te avisaremos cuando el equipo la revise.');
      },
      error: (e) => {
        this.trabajandoId.set(null);
        this.error.set(leerError(e).general);
      },
    });
  }

  protected pedirEliminar(id: string): void {
    this.error.set(null);
    this.confirmandoId.set(id);
  }

  protected eliminar(p: Promocion): void {
    if (this.trabajandoId()) return;
    this.error.set(null);
    this.trabajandoId.set(p.id);
    this.api.eliminarPromocion(this.id(), p.id).subscribe({
      next: () => {
        this.promos.update((l) => l.filter((x) => x.id !== p.id));
        this.trabajandoId.set(null);
        this.confirmandoId.set(null);
        this.aviso.set('Promoción eliminada.');
      },
      error: (e) => {
        this.trabajandoId.set(null);
        this.error.set(leerError(e).general);
      },
    });
  }
}
