import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ResumenReporte, cambio, mesAnterior, resumirReporte } from '../../core/cuenta';
import { I18n } from '../../core/i18n';
import { MiNegocio, ReporteMensual } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';

/** Reporte mensual del negocio, pensado para imprimirse o guardarse como PDF desde el navegador. */
@Component({
  selector: 'app-reporte',
  imports: [RouterLink],
  templateUrl: './reporte.html',
  styleUrl: './reporte.scss',
})
export class Reporte implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly router = inject(Router);

  protected readonly negocios = signal<MiNegocio[]>([]);
  protected readonly negocioId = signal<string | null>(null);
  protected readonly reportes = signal<ReporteMensual[]>([]);
  protected readonly elegido = signal<string | null>(null);
  protected readonly cargandoNegocios = signal(true);
  protected readonly cargandoReportes = signal(false);
  protected readonly fallo = signal(false);

  protected readonly negocio = computed(() => this.negocios().find((n) => n.id === this.negocioId()) ?? null);
  protected readonly actual = computed(() => this.reportes().find((r) => r.id === this.elegido()) ?? null);
  protected readonly resumen = computed<ResumenReporte | null>(() => {
    const r = this.actual();
    return r ? resumirReporte(r) : null;
  });
  protected readonly anterior = computed<ResumenReporte | null>(() => {
    const r = this.actual();
    const a = r ? mesAnterior(this.reportes(), r) : null;
    return a ? resumirReporte(a) : null;
  });
  protected readonly dVistas = computed(() => cambio(this.resumen()?.vistas ?? 0, this.anterior()?.vistas));
  protected readonly dContactos = computed(() => cambio(this.resumen()?.contactos ?? 0, this.anterior()?.contactos));
  protected readonly dTasa = computed(() => {
    const a = this.resumen()?.tasa;
    const b = this.anterior()?.tasa;
    return a != null && b != null ? Math.round((a - b) * 10) / 10 : null;
  });

  constructor() {
    effect(() => {
      if (!this.sesion.listo()) return;
      if (!this.sesion.autenticado()) {
        untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url } }));
        return;
      }
      untracked(() => this.cargarNegocios());
    });
  }

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('reporteMensual'), this.i18n.t('reporteTexto'), 'reporte', { noIndexar: true });
  }

  private cargarNegocios(): void {
    this.api.misNegocios().subscribe({
      next: (l) => {
        this.negocios.set(l);
        this.cargandoNegocios.set(false);
        if (l.length) this.elegirNegocio(l[0].id);
      },
      error: () => { this.fallo.set(true); this.cargandoNegocios.set(false); },
    });
  }

  protected elegirNegocio(id: string): void {
    this.negocioId.set(id);
    this.reportes.set([]);
    this.elegido.set(null);
    this.cargandoReportes.set(true);
    this.fallo.set(false);
    this.api.reportes(id).subscribe({
      next: (l) => {
        const orden = [...l].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
        this.reportes.set(orden);
        this.elegido.set(orden[0]?.id ?? null);
        this.cargandoReportes.set(false);
      },
      error: () => { this.fallo.set(true); this.cargandoReportes.set(false); },
    });
  }

  protected mesTexto(anio: number, mes: number): string {
    return this.i18n.fecha(`${anio}-${String(mes).padStart(2, '0')}-01`, { month: 'long', year: 'numeric' });
  }

  protected rangoTexto(r: ResumenReporte): string {
    const ultimo = new Date(Date.UTC(r.anio, r.mes, 0)).getUTCDate();
    const base = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    return this.i18n.tf('rangoDel', {
      a: this.i18n.fecha(`${base}-01`, { day: 'numeric' }),
      b: this.i18n.fecha(`${base}-${String(ultimo).padStart(2, '0')}`, { day: 'numeric', month: 'long', year: 'numeric' }),
    });
  }

  protected generadoTexto(r: ResumenReporte): string {
    return this.i18n.tf('generadoEl', { fecha: this.i18n.fecha(r.generadoEn.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) });
  }

  protected signo(n: number): string {
    return (n > 0 ? '▲ ' : n < 0 ? '▼ ' : '') + Math.abs(n);
  }

  protected numero(n: number): string {
    return n.toLocaleString(this.i18n.lang() === 'es' ? 'es-MX' : 'en-US');
  }

  protected cambiarMes(id: string): void {
    this.elegido.set(id);
  }

  protected imprimir(): void {
    window.print();
  }

  protected nombreMes(r: ReporteMensual): string {
    return this.mesTexto(r.anio, r.mes);
  }
}
