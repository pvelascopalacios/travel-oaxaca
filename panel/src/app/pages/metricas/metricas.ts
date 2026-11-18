import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Categoria, MetricasGenerales, Region } from '../../core/modelos';
import { DIAS_SIN_CONTACTO_ALERTA, PERIODOS, sinContactoAlerta, tasaTexto } from '../../core/operacion';
import { ErrorApi, categoriasPlanas, fechaCorta, leerError } from '../../core/panel';
import { Variacion, variacionPorcentual, variacionPuntos } from '../../core/ui';
import { VacioEstado } from '../../shared/vacio';

/** Totales y ranking de negocios (7, 30 o 90 días). Lo ven administración, edición y ventas. */
@Component({
  selector: 'app-metricas',
  imports: [FormsModule, DecimalPipe, RouterLink, VacioEstado],
  templateUrl: './metricas.html',
  styleUrl: './metricas.scss',
})
export class Metricas implements OnInit {
  private readonly api = inject(Api);
  protected readonly periodos = PERIODOS;
  protected readonly umbral = DIAS_SIN_CONTACTO_ALERTA;
  protected readonly tasa = tasaTexto;
  protected readonly alerta = sinContactoAlerta;
  protected readonly fecha = fechaCorta;
  protected dias = 30;
  protected regionId = '';
  protected categoriaId = '';
  protected readonly regiones = signal<Region[]>([]);
  protected readonly categorias = signal<{ id: string; etiqueta: string }[]>([]);
  protected readonly datos = signal<MetricasGenerales | null>(null);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly cargando = signal(false);
  /** Totales del periodo anterior (de la misma duración), sacados de restar al periodo doble el periodo actual. */
  private readonly previo = signal<{ vistas: number; contactos: number } | null>(null);
  private pedido = 0;

  protected readonly vVistas = computed<Variacion | null>(() => { const d = this.datos(), p = this.previo(); return d && p ? variacionPorcentual(d.vistas, p.vistas) : null; });
  protected readonly vContactos = computed<Variacion | null>(() => { const d = this.datos(), p = this.previo(); return d && p ? variacionPorcentual(d.contactos, p.contactos) : null; });
  protected readonly vTasa = computed<Variacion | null>(() => {
    const d = this.datos(), p = this.previo();
    return d && p && p.vistas > 0 ? variacionPuntos(d.tasaContacto, p.contactos / p.vistas) : null;
  });

  /** Los cinco con más contactos, para el ranking con barras. */
  protected readonly top = computed(() => [...(this.datos()?.negocios ?? [])].sort((a, b) => b.contactos - a.contactos || b.vistas - a.vistas).slice(0, 5));
  protected readonly maxVistas = computed(() => Math.max(1, ...this.top().map((n) => n.vistas)));
  /** Con vistas pero sin contacto desde hace {{umbral}} días o más: los más vistos primero. */
  protected readonly paraLlamar = computed(() => (this.datos()?.negocios ?? []).filter((n) => this.alerta(n.diasSinContacto, n.vistas)).sort((a, b) => b.vistas - a.vistas).slice(0, 5));
  protected readonly ancho = (v: number, max: number): number => Math.max(2, Math.round((v / max) * 100));

  ngOnInit(): void {
    this.api.regiones().subscribe({ next: (r) => this.regiones.set(r), error: () => undefined });
    this.api.categorias().subscribe({ next: (r: Categoria[]) => this.categorias.set(categoriasPlanas(r)), error: () => undefined });
    this.cargar();
  }

  protected periodo(d: number): void { this.dias = d; this.cargar(); }
  protected quitarFiltros(): void { this.regionId = ''; this.categoriaId = ''; this.cargar(); }

  protected cargar(): void {
    this.fallo.set(null);
    this.cargando.set(true);
    const pedido = ++this.pedido;
    const f = { regionId: this.regionId || null, categoriaId: this.categoriaId || null };
    this.previo.set(null);
    this.api.metricas({ dias: this.dias, ...f }).subscribe({
      next: (d) => { if (pedido !== this.pedido) return; this.datos.set(d); this.cargando.set(false); this.cargarPrevio(pedido, d, f); },
      error: (e) => { if (pedido !== this.pedido) return; this.fallo.set(leerError(e, 'No pudimos cargar las métricas.')); this.cargando.set(false); },
    });
  }

  /** Pide el doble de días y resta el periodo actual. Si falla, solo se quedan sin flecha de cambio. */
  private cargarPrevio(pedido: number, actual: MetricasGenerales, f: { regionId: string | null; categoriaId: string | null }): void {
    this.api.metricas({ dias: this.dias * 2, limite: 1, ...f }).subscribe({
      next: (d) => {
        if (pedido !== this.pedido) return;
        const vistas = d.vistas - actual.vistas;
        const contactos = d.contactos - actual.contactos;
        if (vistas >= 0 && contactos >= 0) this.previo.set({ vistas, contactos });
      },
      error: () => undefined,
    });
  }
}
