import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { esNoEncontrado, parrafos } from '../../core/ficha';
import { I18n } from '../../core/i18n';
import { Parada, RutaPublica } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Comentarios } from '../../shared/comentarios';
import { Guardar } from '../../shared/guardar';
import { GuardarEnLista } from '../../shared/guardar-en-lista';
import { Mapa, Pin } from '../../shared/mapa';
import { NoExiste } from '../../shared/no-existe';

/** Ficha de una ruta: duración, distancia, dificultad y las paradas en orden, numeradas también en el mapa. */
@Component({
  selector: 'app-ruta',
  imports: [Comentarios, RouterLink, Guardar, GuardarEnLista, Mapa, NoExiste],
  templateUrl: './ruta.html',
  styleUrl: '../ficha.scss',
})
export class Ruta implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly r = signal<RutaPublica | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);

  protected readonly descripcion = computed(() => parrafos(this.r()?.descripcion));
  protected readonly paradas = computed(() => [...(this.r()?.paradas ?? [])].sort((a, b) => a.orden - b.orden));
  protected readonly pines = computed<Pin[]>(() =>
    this.paradas()
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.latitud != null && p.longitud != null)
      .map(({ p, i }) => ({ id: `${p.orden}-${i}`, slug: p.slug ?? '', nombre: p.nombre, lat: p.latitud!, lng: p.longitud!, etiqueta: String(i + 1) })),
  );

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((p) => this.cargar(p.get('slug') ?? ''));
  }

  private cargar(slug: string): void {
    this.r.set(null);
    this.noExiste.set(false);
    this.fallo.set(false);
    this.api.ruta(slug).subscribe({
      next: (r) => {
        this.r.set(r);
        this.seo.pagina(r.seo?.titulo || r.nombre, r.seo?.descripcion || r.descripcion || this.i18n.t('rutasSeo'), 'ruta/' + r.slug, { idiomas: r.seo?.idiomasDisponibles });
        this.seo.jsonLd(r.seo?.jsonLd);
      },
      error: (e) => {
        if (esNoEncontrado(e)) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        } else {
          this.fallo.set(true);
        }
        this.seo.pagina(this.i18n.t('noEncontrada'), this.i18n.t('noEncontradaTexto'), '', { noIndexar: true });
      },
    });
  }

  /** Los lugares y negocios llevan a su ficha; los puntos sueltos no. */
  protected destino(p: Parada): string[] | null {
    if (!p.slug) return null;
    if (p.tipo === 'lugar') return ['/', this.i18n.lang(), 'lugar', p.slug];
    if (p.tipo === 'negocio') return ['/', this.i18n.lang(), 'negocio', p.slug];
    return null;
  }

  protected minutos(p: Parada): string {
    return p.minutosEstimados ? this.i18n.tf('nMinutos', { n: p.minutosEstimados }) : '';
  }
}
