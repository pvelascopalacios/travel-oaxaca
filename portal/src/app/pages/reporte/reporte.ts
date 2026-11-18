import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Ficha, ReporteMensual } from '../../core/modelos';
import { ORIGENES, ResumenReporte, cambio, cambioPuntos, fechaCorta, flecha, mesAnterior, nombreAccion, numero, resumirReporte } from '../../core/portal';

/** Reporte mensual de un negocio, pensado para imprimirse o guardarse como PDF desde el navegador. */
@Component({
  selector: 'app-reporte',
  imports: [RouterLink],
  templateUrl: './reporte.html',
  styleUrl: './reporte.scss',
})
export class Reporte implements OnInit {
  /** Viene de la dirección: /negocios/:id/reporte */
  readonly id = input.required<string>();
  private readonly api = inject(Api);

  protected readonly negocio = signal<Ficha | null>(null);
  protected readonly reportes = signal<ReporteMensual[]>([]);
  protected readonly elegido = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);

  protected readonly actual = computed(() => this.reportes().find((r) => r.id === this.elegido()) ?? null);
  protected readonly resumen = computed<ResumenReporte | null>(() => {
    const r = this.actual();
    return r ? resumirReporte(r) : null;
  });
  private readonly anterior = computed<ResumenReporte | null>(() => {
    const r = this.actual();
    const a = r ? mesAnterior(this.reportes(), r) : null;
    return a ? resumirReporte(a) : null;
  });
  protected readonly dVistas = computed(() => cambio(this.resumen()?.vistas ?? 0, this.anterior()?.vistas));
  protected readonly dContactos = computed(() => cambio(this.resumen()?.contactos ?? 0, this.anterior()?.contactos));
  protected readonly dTasa = computed(() => cambioPuntos(this.resumen()?.tasa, this.anterior()?.tasa));

  protected readonly numero = numero;
  protected readonly flecha = flecha;
  protected readonly nombreAccion = nombreAccion;
  protected readonly origenes = ORIGENES;

  ngOnInit(): void {
    this.api.ficha(this.id()).subscribe({ next: (f) => this.negocio.set(f), error: () => undefined });
    this.api.reportes(this.id()).subscribe({
      next: (l) => {
        const orden = [...l].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
        this.reportes.set(orden);
        this.elegido.set(orden[0]?.id ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.fallo.set(true);
        this.cargando.set(false);
      },
    });
  }

  protected nombreMes(r: { anio: number; mes: number }): string {
    return fechaCorta(`${r.anio}-${String(r.mes).padStart(2, '0')}-01`, { month: 'long', year: 'numeric' });
  }

  protected rango(r: ResumenReporte): string {
    const base = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    const ultimo = new Date(Date.UTC(r.anio, r.mes, 0)).getUTCDate();
    return `Del ${fechaCorta(base + '-01', { day: 'numeric' })} al ${fechaCorta(`${base}-${String(ultimo).padStart(2, '0')}`, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  protected generado(r: ResumenReporte): string {
    return 'Generado el ' + fechaCorta(r.generadoEn.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
  }

  protected elegir(id: string): void {
    this.elegido.set(id);
  }

  protected imprimir(): void {
    window.print();
  }
}
