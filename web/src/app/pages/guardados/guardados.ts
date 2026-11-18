import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Favoritos } from '../../core/favoritos';
import { I18n } from '../../core/i18n';
import { Favorito, TipoFavorito } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';
import { Imagen } from '../../shared/imagen';

/** Lo que la persona guardó. Sin sesión invita a ingresar; lo que ya no está publicado no aparece (lo filtra la API). */
@Component({
  selector: 'app-guardados',
  imports: [RouterLink, Imagen],
  templateUrl: './guardados.html',
  styleUrl: './guardados.scss',
})
export class Guardados implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly router = inject(Router);
  private readonly favoritos = inject(Favoritos);

  protected readonly lista = signal<Favorito[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);
  protected readonly filtro = signal<TipoFavorito | 'todo'>('todo');
  protected readonly tipos: (TipoFavorito | 'todo')[] = ['todo', 'negocio', 'lugar', 'ruta'];

  protected readonly visibles = computed(() => this.lista().filter((f) => f.imagenUrl && (this.filtro() === 'todo' || f.tipo === this.filtro())));
  /** Una tarjeta sin foto no se muestra, pero tampoco debe contar como guardada «invisible». */
  private readonly conFoto = computed(() => this.lista().filter((f) => f.imagenUrl));

  constructor() {
    effect(() => {
      if (this.sesion.listo() && this.sesion.autenticado()) untracked(() => this.cargar());
    });
  }

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('guardados'), this.i18n.t('guardadosTexto'), 'guardados', { noIndexar: true });
  }

  protected cuenta(t: TipoFavorito | 'todo'): number {
    return t === 'todo' ? this.conFoto().length : this.conFoto().filter((f) => f.tipo === t).length;
  }

  private cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.api.favoritos().subscribe({
      next: (l) => { this.lista.set([...l].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))); this.cargando.set(false); },
      error: () => { this.fallo.set(true); this.cargando.set(false); },
    });
  }

  protected enlace(f: Favorito): string[] {
    return ['/', this.i18n.lang(), f.tipo, f.slug];
  }

  protected quitar(f: Favorito): void {
    this.lista.set(this.lista().filter((x) => !(x.tipo === f.tipo && x.id === f.id)));
    this.favoritos.alternar(f.tipo, f.id, () => this.cargar());
  }

  protected guardadoEl(f: Favorito): string {
    return this.i18n.tf('guardadoEl', { fecha: this.i18n.fecha(f.creadoEn.slice(0, 10)) });
  }

  protected ingresar(): void {
    void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url } });
  }
}
