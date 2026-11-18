import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Api } from '../../core/api';
import { CONTACTO_PLANES } from '../../core/config';
import {
  conceptoTexto, contactoEnlace, diasTexto, dinero, estadoPago, estadoSuscripcion, fechaLarga, metodoTexto, periodoPlanTexto, precioGeneral, usoPorcentaje,
} from '../../core/comercial';
import { Ficha, Pago, PlanNegocio, PlanPublico, Suscripcion } from '../../core/modelos';
import { ErrorApi, estadoInfo, leerError } from '../../core/portal';

/** Plan del negocio, lo que incluye cada plan, historial de suscripciones y pagos. Solo lectura: el equipo registra los cambios. */
@Component({
  selector: 'app-plan',
  templateUrl: './plan.html',
  styleUrl: './plan.scss',
})
export class Plan implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  protected readonly contacto = contactoEnlace(inject(CONTACTO_PLANES).valor);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly plan = signal<PlanNegocio | null>(null);
  protected readonly planes = signal<PlanPublico[] | null>(null);
  protected readonly suscripciones = signal<Suscripcion[] | null>(null);
  protected readonly pagos = signal<Pago[] | null>(null);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly falloPlanes = signal(false);
  protected readonly falloHistorial = signal(false);
  protected readonly falloPagos = signal(false);
  protected readonly periodo = signal<'mensual' | 'anual'>('mensual');

  protected readonly estadoNegocio = estadoInfo;
  protected readonly estadoSus = estadoSuscripcion;
  protected readonly estadoPago = estadoPago;
  protected readonly fecha = fechaLarga;
  protected readonly dinero = dinero;
  protected readonly metodo = metodoTexto;
  protected readonly concepto = conceptoTexto;
  protected readonly periodoTexto = periodoPlanTexto;
  protected readonly dias = diasTexto;
  protected readonly pct = usoPorcentaje;

  /** Hay algún plan con precio general vigente; si no, no se muestra el selector mensual/anual. */
  protected readonly hayPrecios = computed(() => (this.planes() ?? []).some((p) => precioGeneral(p, 'mensual') || precioGeneral(p, 'anual')));
  protected precio(p: PlanPublico): string | null {
    const x = precioGeneral(p, this.periodo());
    return x ? dinero(x.monto, x.moneda) : null;
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.falloPlanes.set(false);
    this.falloHistorial.set(false);
    this.falloPagos.set(false);
    this.api.ficha(this.id()).subscribe({ next: (f) => this.ficha.set(f), error: () => undefined });
    this.api.plan(this.id()).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar tu plan. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
    // Cada sección falla por separado: un error en una no tapa a las demás.
    this.api.planesPublicos().subscribe({ next: (l) => this.planes.set(l), error: () => this.falloPlanes.set(true) });
    this.api.suscripciones(this.id()).subscribe({ next: (l) => this.suscripciones.set(l), error: () => this.falloHistorial.set(true) });
    this.api.pagos(this.id()).subscribe({ next: (l) => this.pagos.set(l), error: () => this.falloPagos.set(true) });
  }

  protected nombrePlan(clave: string): string {
    return this.planes()?.find((p) => p.clave === clave)?.nombre ?? clave;
  }
}
