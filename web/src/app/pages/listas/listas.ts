import { Component, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, leerError } from '../../core/cuenta';
import { I18n } from '../../core/i18n';
import { TOPE_LISTAS, diasDeItinerario, ordenarListas, rangoFechas } from '../../core/listas';
import { ListaEntrada, ListaResumen } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';
import { FormularioLista } from '../../shared/formulario-lista';

/** Las listas e itinerarios de la persona, y la forma de crear una nueva. Pide sesión. */
@Component({
  selector: 'app-listas',
  imports: [RouterLink, FormularioLista],
  templateUrl: './listas.html',
  styleUrl: './listas.scss',
})
export class Listas implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly router = inject(Router);

  protected readonly listas = signal<ListaResumen[] | null>(null);
  protected readonly fallo = signal(false);
  protected readonly formulario = viewChild(FormularioLista);
  protected readonly abierto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly aviso = signal<string | null>(null);
  protected readonly ordenadas = computed(() => ordenarListas(this.listas() ?? []));
  protected readonly tope = TOPE_LISTAS;

  constructor() {
    effect(() => {
      if (!this.sesion.listo()) return;
      if (this.sesion.autenticado()) untracked(() => { if (this.listas() === null) this.cargar(); });
      else untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: `/${this.i18n.lang()}/listas` } }));
    });
  }

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('listasTitulo'), this.i18n.t('listasSeo'), 'listas', { noIndexar: true });
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.listas().subscribe({
      next: (l) => this.listas.set(l),
      error: () => { this.listas.set([]); this.fallo.set(true); },
    });
  }

  protected crear(e: ListaEntrada): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    this.api.crearLista(e).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.listas.set([...(this.listas() ?? []), r.datos]);
        this.formulario()?.limpiar();
        this.abierto.set(false);
        this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('listaCreada'));
      },
      error: (er) => { this.enviando.set(false); this.error.set(leerError(er, this.i18n.t('errorCarga'))); },
    });
  }

  protected abrir(): void {
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    this.abierto.set(true);
  }

  protected contador(): string {
    return this.i18n.tf('listasContador', { n: this.listas()?.length ?? 0, max: this.tope });
  }

  protected elementos(l: ListaResumen): string {
    if (l.totalElementos === 0) return this.i18n.t('listaSinElementos');
    return l.totalElementos === 1 ? this.i18n.t('listaElementoUno') : this.i18n.tf('listaElementosN', { n: l.totalElementos });
  }

  protected dias(l: ListaResumen): string | null {
    const n = diasDeItinerario(l.fechaInicio, l.fechaFin);
    return n == null ? null : n === 1 ? this.i18n.t('listaDiaN') : this.i18n.tf('listaDiasN', { n });
  }

  protected fechas(l: ListaResumen): string | null {
    return rangoFechas(l.fechaInicio, l.fechaFin, (iso) => this.i18n.fecha(iso, { day: 'numeric', month: 'short', year: 'numeric' }));
  }

  protected banda(i: number): string {
    return 'banda b' + (i % 4);
  }
}
