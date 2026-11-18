import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { leerError } from '../../core/cuenta';
import { I18n } from '../../core/i18n';
import { estadoResena } from '../../core/listas';
import { ResenaPropia } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';

/** Todas las reseñas que la persona escribió, con su estado; editar lleva a la pantalla de reseña del negocio. */
@Component({
  selector: 'app-mis-resenas',
  imports: [RouterLink],
  templateUrl: './mis-resenas.html',
  styleUrls: ['../listas/listas.scss', './mis-resenas.scss'],
})
export class MisResenas implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly router = inject(Router);

  protected readonly resenas = signal<ResenaPropia[] | null>(null);
  protected readonly fallo = signal(false);
  protected readonly confirmar = signal<string | null>(null);
  protected readonly borrando = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly estrellas = [1, 2, 3, 4, 5];

  constructor() {
    effect(() => {
      if (!this.sesion.listo()) return;
      if (this.sesion.autenticado()) untracked(() => { if (this.resenas() === null) this.cargar(); });
      else untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: `/${this.i18n.lang()}/mis-resenas` } }));
    });
  }

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('misResenasTitulo'), this.i18n.t('misResenasSeo'), 'mis-resenas', { noIndexar: true });
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.misResenas().subscribe({
      next: (l) => this.resenas.set(l),
      error: () => { this.resenas.set([]); this.fallo.set(true); },
    });
  }

  protected borrar(r: ResenaPropia): void {
    if (this.borrando()) return;
    this.borrando.set(true);
    this.aviso.set(null);
    this.error.set(null);
    this.api.borrarResena(r.id).subscribe({
      next: (x) => {
        this.borrando.set(false);
        this.confirmar.set(null);
        this.resenas.set((this.resenas() ?? []).filter((y) => y.id !== r.id));
        this.aviso.set(x.mensajes?.[0] ?? this.i18n.t('misResenasBorrada'));
      },
      error: (e) => { this.borrando.set(false); this.error.set(leerError(e, this.i18n.t('errorCarga')).general); },
    });
  }

  protected estado(r: ResenaPropia) {
    return estadoResena(r.estado);
  }

  protected visita(r: ResenaPropia): string | null {
    return r.fechaVisita ? this.i18n.tf('misResenasVisita', { fecha: this.i18n.fecha(r.fechaVisita, { day: 'numeric', month: 'short', year: 'numeric' }) }) : null;
  }

  protected utiles(r: ResenaPropia): string | null {
    return r.utiles > 0 ? this.i18n.tf('misResenasUtiles', { n: r.utiles }) : null;
  }
}
