import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { concatMap, from, toArray } from 'rxjs';
import { Api } from '../../core/api';
import { raizDeCategoria } from '../../core/edicion';
import { Categoria, Ficha, Oferta, PlanNegocio } from '../../core/modelos';
import {
  GrupoOpciones, accionDeEstado, agrupar, cupoOfertas, duracionTexto, entradaDeOferta, estadoOfertaInfo, marcaTexto, moverOferta, nombreDe, nombreTipo, nombreTipoNuevo,
  precioTexto, tiposDeRaiz, tituloLista,
} from '../../core/opciones';
import { ErrorApi, leerError } from '../../core/portal';
import { CabeceraOpciones } from '../../shared/cabecera-opciones';
import { FormOpcion, OpcionGuardada } from './form-opcion';

/** Menú, habitaciones, tours y experiencias, o productos: lo que el negocio ofrece, con su precio y estado. */
@Component({
  selector: 'app-opciones',
  imports: [CabeceraOpciones, FormOpcion],
  templateUrl: './opciones.html',
  styleUrl: './opciones.scss',
})
export class Opciones implements OnInit {
  /** Viene de la dirección: /negocios/:id/opciones */
  readonly id = input.required<string>();
  private readonly api = inject(Api);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly ofertas = signal<Oferta[]>([]);
  protected readonly plan = signal<PlanNegocio | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);

  protected readonly editando = signal<{ oferta: Oferta | null } | null>(null);
  protected readonly trabajandoId = signal<string | null>(null);
  protected readonly confirmandoId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly nombreDe = nombreDe;
  protected readonly nombreTipo = nombreTipo;
  protected readonly estadoInfo = estadoOfertaInfo;
  protected readonly accion = accionDeEstado;
  protected readonly precio = precioTexto;
  protected readonly duracion = duracionTexto;
  protected readonly marca = marcaTexto;

  protected readonly raiz = computed(() => raizDeCategoria(this.arbol(), this.ficha()?.categoriaId ?? ''));
  protected readonly tipos = computed(() => tiposDeRaiz(this.raiz()));
  protected readonly titulo = computed(() => tituloLista(this.raiz()));
  protected readonly textoAgregar = computed(() => (this.tipos().length > 1 ? 'Agregar tour o experiencia' : 'Agregar ' + nombreTipoNuevo(this.tipos()[0] ?? '')));
  protected readonly cupo = computed(() => cupoOfertas(this.plan(), this.ofertas()));
  protected readonly porcentaje = computed(() => Math.min(100, Math.round((100 * this.cupo().usadas) / Math.max(1, this.cupo().limite))));
  protected readonly lista = computed(() => agrupar(this.ofertas(), this.raiz()));
  /** En revisión o archivada no se editan las opciones (la API también lo rechaza). */
  protected readonly soloLectura = computed(() => ['en_revision', 'archivada'].includes(this.ficha()?.estado ?? ''));
  protected readonly puedeAgregar = computed(() => !this.soloLectura() && this.tipos().length > 0 && !this.cupo().sinPlan && !this.cupo().lleno);
  protected readonly ordenNuevo = computed(() => this.ofertas().reduce((m, o) => Math.max(m, o.orden + 1), 0));

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.ficha(this.id()).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.ofertas.set(f.ofertas ?? []);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar tu negocio. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
    // El plan y las categorías son de apoyo: si fallan, la página sigue y la API decide al final.
    this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  // ---------------- crear y cambiar ----------------

  protected nueva(): void {
    this.aviso.set(null);
    this.error.set(null);
    this.editando.set({ oferta: null });
  }

  protected cambiar(o: Oferta): void {
    this.aviso.set(null);
    this.error.set(null);
    this.confirmandoId.set(null);
    this.editando.set({ oferta: o });
  }

  protected alGuardar(r: OpcionGuardada): void {
    this.reemplazar(r.oferta);
    this.editando.set(null);
    this.aviso.set(r.aviso ?? 'Guardado.');
    // El plan lleva la cuenta de lo usado: se vuelve a pedir en silencio.
    this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
  }

  private reemplazar(o: Oferta): void {
    this.ofertas.update((l) => (l.some((x) => x.id === o.id) ? l.map((x) => (x.id === o.id ? o : x)) : [...l, o]));
  }

  // ---------------- estado, orden y eliminar ----------------

  protected cambiarEstado(o: Oferta, destino: string): void {
    if (this.trabajandoId()) return;
    this.preparar(o.id);
    this.api.estadoOferta(this.id(), o.id, destino).subscribe({
      next: (r) => {
        this.reemplazar(r.datos);
        this.trabajandoId.set(null);
      },
      error: (e) => this.fallar(e),
    });
  }

  protected mover(g: GrupoOpciones, o: Oferta, d: -1 | 1): void {
    if (this.trabajandoId()) return;
    const cambios = moverOferta(g.ofertas, o.id, d);
    if (!cambios.length) return;
    this.preparar(o.id);
    from(cambios)
      .pipe(
        concatMap((c) => this.api.actualizarOferta(this.id(), c.id, entradaDeOferta(this.ofertas().find((x) => x.id === c.id) as Oferta, c.orden))),
        toArray(),
      )
      .subscribe({
        next: (rs) => {
          rs.forEach((r) => this.reemplazar(r.datos));
          this.trabajandoId.set(null);
        },
        error: (e) => {
          this.fallar(e);
          this.recargarOfertas();
        },
      });
  }

  protected pedirEliminar(id: string): void {
    this.error.set(null);
    this.confirmandoId.set(id);
  }

  protected eliminar(o: Oferta): void {
    if (this.trabajandoId()) return;
    this.preparar(o.id);
    this.api.eliminarOferta(this.id(), o.id).subscribe({
      next: () => {
        this.ofertas.update((l) => l.filter((x) => x.id !== o.id));
        this.trabajandoId.set(null);
        this.confirmandoId.set(null);
        this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
      },
      error: (e) => this.fallar(e),
    });
  }

  private preparar(id: string): void {
    this.error.set(null);
    this.aviso.set(null);
    this.trabajandoId.set(id);
  }

  private fallar(e: unknown): void {
    this.trabajandoId.set(null);
    this.error.set(leerError(e).general);
  }

  private recargarOfertas(): void {
    this.api.ofertas(this.id()).subscribe({ next: (l) => this.ofertas.set(l), error: () => undefined });
  }
}
