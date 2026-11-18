import { DOCUMENT } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { PORTAL_URL } from '../../core/config';
import { I18n } from '../../core/i18n';
import { PlanPublico } from '../../core/modelos';
import { Periodo, enlacePortal, esGratis, ordenarPlanes, periodosDisponibles, precioVisible } from '../../core/planes';
import { Seo } from '../../core/seo';
import { ContactoNegocio } from '../../shared/contacto-negocio';
import { Clave } from '../../core/textos';

const PASOS: { titulo: Clave; texto: Clave }[] = [
  { titulo: 'pnPaso1T', texto: 'pnPaso1D' },
  { titulo: 'pnPaso2T', texto: 'pnPaso2D' },
  { titulo: 'pnPaso3T', texto: 'pnPaso3D' },
  { titulo: 'pnPaso4T', texto: 'pnPaso4D' },
];
const PREGUNTAS: { q: Clave; a: Clave }[] = [
  { q: 'pnQ1', a: 'pnA1' },
  { q: 'pnQ2', a: 'pnA2' },
  { q: 'pnQ3', a: 'pnA3' },
];

/** Página de venta para dueños de negocio. Registro e ingreso viven en el portal del negocio. */
@Component({
  selector: 'app-para-negocios',
  imports: [ContactoNegocio],
  templateUrl: './para-negocios.html',
  styleUrl: './para-negocios.scss',
})
export class ParaNegocios implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly portal = inject(PORTAL_URL);
  private readonly doc = inject(DOCUMENT);

  protected readonly pasos = PASOS;
  protected readonly preguntas = PREGUNTAS;
  protected readonly registro = enlacePortal(this.portal, 'registro');
  protected readonly ingreso = enlacePortal(this.portal, 'ingreso');
  protected readonly planes = signal<PlanPublico[] | null>(null);
  protected readonly fallo = signal(false);
  protected readonly periodo = signal<Periodo>('anual');
  protected readonly periodos = computed(() => periodosDisponibles(this.planes() ?? []));
  protected readonly esGratis = esGratis;
  protected readonly precio = (p: PlanPublico) => precioVisible(p, this.periodo());

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('pnSeoTitulo'), this.i18n.t('pnSeoDescripcion'), 'para-negocios');
    this.cargar();
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.planes().subscribe({
      next: (l) => {
        const ordenados = ordenarPlanes(l);
        this.planes.set(ordenados);
        const disp = periodosDisponibles(ordenados);
        if (disp.length && !disp.includes(this.periodo())) this.periodo.set(disp[0]);
      },
      error: () => this.fallo.set(true),
    });
  }

  /** Baja a los planes sin cambiar de dirección (un enlace #planes saldría de la página por el <base href>). */
  protected irAPlanes(): void {
    this.doc.getElementById('planes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected irAContacto(): void {
    this.doc.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected montoTexto(monto: number, moneda: string): string {
    return this.i18n.precio(monto, moneda);
  }
}
