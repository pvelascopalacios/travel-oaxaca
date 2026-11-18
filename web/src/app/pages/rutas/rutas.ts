import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Api } from '../../core/api';
import { I18n } from '../../core/i18n';
import { RutaTarjeta } from '../../core/modelos';
import { Seo } from '../../core/seo';

/** Todas las rutas publicadas. */
@Component({
  selector: 'app-rutas',
  imports: [RouterLink],
  template: `
    <div class="contenedor pagina">
      <nav class="migas" [attr.aria-label]="i18n.t('inicio')">
        <a [routerLink]="['/', i18n.lang()]">{{ i18n.t('inicio') }}</a>
        <span aria-hidden="true">›</span>
        <span>{{ i18n.t('rutasTitulo') }}</span>
      </nav>
      <header class="cabecera">
        <h1>{{ i18n.t('rutasTitulo') }}</h1>
        <p class="suave">{{ i18n.t('rutasTexto') }}</p>
      </header>
      @if (fallo()) {
        <p class="aviso-error">{{ i18n.t('errorCarga') }}</p>
      } @else if (!cargando() && !rutas().length) {
        <p class="aviso-error">{{ i18n.t('rutasVacia') }}</p>
      }
      <ul class="tarjetas lista-rutas">
        @for (r of rutas(); track r.id) {
          <li class="oferta">
            <div class="fila">
              <h2 class="ruta-nombre"><a [routerLink]="['/', i18n.lang(), 'ruta', r.slug]">{{ r.nombre }}</a></h2>
              @if (r.esPremium) {
                <span class="chip patrocinado">{{ i18n.t('rutaPremium') }}</span>
              }
            </div>
            @if (r.descripcion) {
              <p class="suave">{{ r.descripcion }}</p>
            }
            <ul class="etiquetas">
              @if (r.duracionHoras) {
                <li>{{ i18n.tf('nHoras', { n: r.duracionHoras }) }}</li>
              }
              @if (r.distanciaKm) {
                <li>{{ i18n.tf('nKm', { n: r.distanciaKm }) }}</li>
              }
              @if (r.dificultad) {
                <li>{{ i18n.tDinamico('dificultad', r.dificultad) }}</li>
              }
            </ul>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: '../ficha.scss',
  styles: `
    .ruta-nombre {
      margin: 0;
      font: 700 1.2rem var(--fuente-titulo);
    }
    .ruta-nombre a {
      color: inherit;
    }
    .lista-rutas {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    }
  `,
})
export class Rutas implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  protected readonly rutas = signal<RutaTarjeta[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('rutasTitulo'), this.i18n.t('rutasSeo'), 'rutas');
    this.api
      .rutas({ tamano: 50 })
      .pipe(catchError(() => { this.fallo.set(true); return of(null); }))
      .subscribe((p) => {
        this.cargando.set(false);
        this.rutas.set(p?.elementos ?? []);
      });
  }
}
