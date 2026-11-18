import { Component, OnInit, RESPONSE_INIT, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, leerError } from '../../core/cuenta';
import { esNoEncontrado } from '../../core/ficha';
import { I18n } from '../../core/i18n';
import { GrupoDia, MAX_NOTA, agruparPorDia, claveTipoElemento, diasDeItinerario, moverEnGrupo, rangoFechas, rutaDeElemento } from '../../core/listas';
import { ListaDetalle, ListaElemento, ListaEntrada } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';
import { FormularioLista } from '../../shared/formulario-lista';
import { Imagen } from '../../shared/imagen';
import { NoExiste } from '../../shared/no-existe';

/** Una de mis listas o itinerarios: sus elementos por día, notas, orden, compartir y borrar. */
@Component({
  selector: 'app-mi-lista',
  imports: [FormsModule, RouterLink, FormularioLista, Imagen, NoExiste],
  templateUrl: './mi-lista.html',
  styleUrls: ['../listas/listas.scss', './mi-lista.scss'],
})
export class MiLista implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  private id = '';
  protected readonly lista = signal<ListaDetalle | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);
  protected readonly editando = signal(false);
  protected readonly guardandoLista = signal(false);
  protected readonly errorLista = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly confirmarBorrar = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly errorCambio = signal<string | null>(null);
  protected readonly notaDe = signal<string | null>(null);
  protected notaTexto = '';
  protected readonly enlaceManual = signal<string | null>(null);
  protected readonly maxNota = MAX_NOTA;

  protected readonly grupos = computed<GrupoDia[]>(() => {
    const l = this.lista();
    return l ? agruparPorDia(l.elementos, l.esItinerario, l.fechaInicio, l.fechaFin) : [];
  });
  protected readonly diasPosibles = computed(() => this.grupos().filter((g) => g.dia != null).map((g) => g.dia as number));
  protected readonly valorFormulario = computed<ListaEntrada | null>(() => {
    const l = this.lista();
    return l ? { nombre: l.nombre, esItinerario: l.esItinerario, fechaInicio: l.fechaInicio, fechaFin: l.fechaFin, publica: l.publica } : null;
  });

  constructor() {
    effect(() => {
      if (!this.sesion.listo()) return;
      if (this.sesion.autenticado()) untracked(() => { if (!this.lista() && !this.noExiste()) this.cargar(); });
      else untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url } }));
    });
  }

  ngOnInit(): void {
    this.id = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.seo.pagina(this.i18n.t('listasTitulo'), this.i18n.t('listasSeo'), `listas/${this.id}`, { noIndexar: true });
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.miLista(this.id).subscribe({
      next: (l) => this.lista.set(l),
      error: (e) => {
        if (esNoEncontrado(e)) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        } else this.fallo.set(true);
      },
    });
  }

  private falla(e: unknown): void {
    this.ocupado.set(false);
    this.errorCambio.set(leerError(e, this.i18n.t('listaErrorCambio')).general ?? this.i18n.t('listaErrorCambio'));
  }

  private tras(d: ListaDetalle): void {
    this.ocupado.set(false);
    this.lista.set(d);
  }

  /** Antes de cada cambio se limpian los avisos viejos; si ya hay uno en curso, se ignora el toque. */
  private iniciar(): boolean {
    if (this.ocupado()) return false;
    this.ocupado.set(true);
    this.aviso.set(null);
    this.errorCambio.set(null);
    return true;
  }

  // ---------------- la lista ----------------

  protected guardarLista(e: ListaEntrada): void {
    if (this.guardandoLista()) return;
    this.guardandoLista.set(true);
    this.errorLista.set({ general: null, campos: {} });
    this.api.editarLista(this.id, e).subscribe({
      next: (r) => {
        this.guardandoLista.set(false);
        this.editando.set(false);
        this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('listaGuardada'));
        this.api.miLista(this.id).subscribe({ next: (l) => this.lista.set(l), error: () => this.fallo.set(true) });
      },
      error: (er) => { this.guardandoLista.set(false); this.errorLista.set(leerError(er, this.i18n.t('errorCarga'))); },
    });
  }

  protected borrar(): void {
    if (!this.iniciar()) return;
    this.api.borrarLista(this.id).subscribe({
      next: () => void this.router.navigate(['/', this.i18n.lang(), 'listas']),
      error: (e) => { this.falla(e); this.confirmarBorrar.set(false); },
    });
  }

  protected enlace(): string {
    return `${location.origin}/${this.i18n.lang()}/lista/${this.id}`;
  }

  protected async copiarEnlace(): Promise<void> {
    this.aviso.set(null);
    this.enlaceManual.set(null);
    try {
      await navigator.clipboard.writeText(this.enlace());
      this.aviso.set(this.i18n.t('listaEnlaceCopiado'));
    } catch {
      // Sin permiso de portapapeles se muestra el enlace para copiarlo a mano.
      this.enlaceManual.set(this.enlace());
    }
  }

  // ---------------- elementos ----------------

  protected mover(g: GrupoDia, e: ListaElemento, dir: -1 | 1): void {
    const cambios = moverEnGrupo(g.elementos, e.itemId, dir);
    if (!cambios.length || !this.iniciar()) return;
    const peticiones = cambios.map((c) => {
      const el = g.elementos.find((x) => x.itemId === c.itemId) as ListaElemento;
      return { itemId: c.itemId, cuerpo: { dia: el.dia, orden: c.orden, nota: el.nota } };
    });
    this.api.editarElementos(this.id, peticiones).subscribe({
      next: () => this.api.miLista(this.id).subscribe({ next: (d) => this.tras(d), error: (er) => this.falla(er) }),
      error: (er) => { this.falla(er); this.cargar(); },
    });
  }

  protected cambiarDia(e: ListaElemento, valor: string): void {
    const dia = valor === '' ? null : Number(valor);
    if (dia === e.dia || !this.iniciar()) return;
    const destino = this.grupos().find((g) => g.dia === dia);
    this.api.editarElemento(this.id, e.itemId, { dia, orden: destino ? destino.elementos.length : 0, nota: e.nota }).subscribe({
      next: (r) => this.tras(r.datos),
      error: (er) => { this.falla(er); this.cargar(); },
    });
  }

  protected quitar(e: ListaElemento): void {
    if (!this.iniciar()) return;
    this.api.quitarElemento(this.id, e.itemId).subscribe({
      next: () => {
        this.ocupado.set(false);
        const l = this.lista();
        if (l) this.lista.set({ ...l, elementos: l.elementos.filter((x) => x.itemId !== e.itemId) });
      },
      error: (er) => this.falla(er),
    });
  }

  protected editarNota(e: ListaElemento): void {
    this.notaDe.set(e.itemId);
    this.notaTexto = e.nota ?? '';
  }

  protected guardarNota(e: ListaElemento): void {
    if (!this.iniciar()) return;
    this.api.editarElemento(this.id, e.itemId, { dia: e.dia, orden: null, nota: this.notaTexto.trim() || null }).subscribe({
      next: (r) => { this.tras(r.datos); this.notaDe.set(null); },
      error: (er) => this.falla(er),
    });
  }

  protected tituloDia(g: GrupoDia): string {
    return g.dia == null ? this.i18n.t('listaSinDia') : this.i18n.tf('listaDia', { n: g.dia });
  }

  protected fechaDia(g: GrupoDia): string | null {
    return g.fecha ? this.i18n.fecha(g.fecha, { weekday: 'short', day: 'numeric', month: 'short' }) : null;
  }

  protected resumen(l: ListaDetalle): string {
    const partes: string[] = [];
    if (l.esItinerario) {
      const n = diasDeItinerario(l.fechaInicio, l.fechaFin);
      partes.push(this.i18n.t('listaItinerarioEtiqueta') + (n ? ` · ${n === 1 ? this.i18n.t('listaDiaN') : this.i18n.tf('listaDiasN', { n })}` : ''));
    }
    const f = rangoFechas(l.fechaInicio, l.fechaFin, (iso) => this.i18n.fecha(iso, { day: 'numeric', month: 'short', year: 'numeric' }));
    if (f) partes.push(f);
    return partes.join(' · ');
  }

  protected enlaceElemento(e: ListaElemento): string[] {
    return rutaDeElemento(e, this.i18n.lang());
  }

  protected tipo(e: ListaElemento) {
    return claveTipoElemento(e.tipo);
  }
}
