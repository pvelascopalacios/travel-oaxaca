import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Idioma, IDIOMAS } from '../core/config';
import { GRUPOS } from '../core/grupos';
import { I18n } from '../core/i18n';
import { Sesion } from '../core/sesion';
import { Buscador } from '../shared/buscador';

/** Marco de todas las páginas: encabezado, grupos, barra inferior en móvil y pie. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Buscador],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  protected readonly grupos = GRUPOS;
  protected readonly idiomas = IDIOMAS;

  /** En el inicio el encabezado nace limpio y, al bajar, muestra el buscador y los grupos. */
  protected readonly bajado = signal(false);

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const revisar = () => this.bajado.set(window.scrollY > 240);
      revisar();
      window.addEventListener('scroll', revisar, { passive: true });
      destruir.onDestroy(() => window.removeEventListener('scroll', revisar));
    });
  }

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** La misma página en el otro idioma: cambia solo el prefijo. */
  protected readonly enOtroIdioma = computed(() => {
    const resto = this.url().replace(/^\/(es|en)(?=\/|$|\?)/, '');
    return (lang: Idioma) => `/${lang}${resto}`;
  });

  protected readonly esInicio = computed(() => /^\/(es|en)\/?(\?.*)?$/.test(this.url()));

  /** Buscador y grupos visibles en el encabezado: siempre, salvo arriba del todo en el inicio. */
  protected readonly menusVisibles = computed(() => !this.esInicio() || this.bajado());
}
