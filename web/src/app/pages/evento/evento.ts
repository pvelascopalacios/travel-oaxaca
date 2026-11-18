import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { bloqueDeFecha, calendarioUrl, comoLlegarUrl, esNoEncontrado, hhmm, parrafos } from '../../core/ficha';
import { I18n } from '../../core/i18n';
import { EventoPublico } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Comentarios } from '../../shared/comentarios';
import { Galeria } from '../../shared/galeria';
import { Mapa, Pin } from '../../shared/mapa';
import { NoExiste } from '../../shared/no-existe';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';

/** Ficha de un evento: fechas, sede, costo, cómo agregarlo al calendario y los negocios donde vivirlo. */
@Component({
  selector: 'app-evento',
  imports: [Comentarios, RouterLink, Galeria, Mapa, NoExiste, TarjetaNegocio],
  templateUrl: './evento.html',
  styleUrl: '../ficha.scss',
})
export class Evento implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly e = signal<EventoPublico | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);

  protected readonly descripcion = computed(() => parrafos(this.e()?.descripcion));
  protected readonly pines = computed<Pin[]>(() => {
    const e = this.e();
    return e && e.latitud != null && e.longitud != null ? [{ id: e.id, slug: e.slug, nombre: e.nombre, lat: e.latitud, lng: e.longitud, etiqueta: '' }] : [];
  });
  protected readonly llegar = computed(() => {
    const e = this.e();
    return e && e.latitud != null && e.longitud != null ? comoLlegarUrl(e.latitud, e.longitud) : null;
  });
  protected readonly fechas = computed(() => {
    const e = this.e();
    if (!e) return '';
    const largo: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    if (!e.fechaFin || e.fechaFin === e.fechaInicio) return this.i18n.fecha(e.fechaInicio, { weekday: 'long', ...largo });
    // Mismo mes: «20 – 22 de noviembre de 2026»; si no, el mes va en las dos fechas.
    const inicio: Intl.DateTimeFormatOptions = e.fechaInicio.slice(0, 7) === e.fechaFin.slice(0, 7) ? { day: 'numeric' } : { day: 'numeric', month: 'long' };
    return `${this.i18n.fecha(e.fechaInicio, inicio)} – ${this.i18n.fecha(e.fechaFin, largo)}`;
  });
  /** El bloque de color junto al título: «20–22» y «NOV». */
  protected readonly bloqueFecha = computed(() => {
    const e = this.e();
    return e ? bloqueDeFecha(e.fechaInicio, e.fechaFin, (f) => this.i18n.fecha(f, { month: 'short' })) : { dias: '', mes: '' };
  });
  protected readonly horas = computed(() => {
    const d = this.e()?.datos;
    const a = hhmm(typeof d?.['horaInicio'] === 'string' ? (d['horaInicio'] as string) : null);
    const b = hhmm(typeof d?.['horaFin'] === 'string' ? (d['horaFin'] as string) : null);
    return a && b ? this.i18n.tf('horaDeA', { a, b }) : a;
  });
  protected readonly costo = computed(() => {
    const d = this.e()?.datos;
    if (!d) return null;
    if (d['gratis'] === true) return this.i18n.t('gratis');
    return typeof d['costoTexto'] === 'string' && d['costoTexto'].trim() ? (d['costoTexto'] as string) : null;
  });
  protected readonly sede = computed(() => {
    const d = this.e()?.datos;
    return typeof d?.['sede'] === 'string' && d['sede'].trim() ? (d['sede'] as string) : null;
  });
  protected readonly calendario = computed(() => {
    const e = this.e();
    if (!e) return null;
    const lugar = [this.sede(), e.municipioNombre, 'Oaxaca'].filter(Boolean).join(', ');
    return calendarioUrl(e.nombre, e.fechaInicio, e.fechaFin || e.fechaInicio, lugar);
  });

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((p) => this.cargar(p.get('slug') ?? ''));
  }

  private cargar(slug: string): void {
    this.e.set(null);
    this.noExiste.set(false);
    this.fallo.set(false);
    this.api.evento(slug).subscribe({
      next: (e) => {
        this.e.set(e);
        this.seo.pagina(e.seo?.titulo || e.nombre, e.seo?.descripcion || e.descripcion || this.i18n.tf('eventoSeo', { nombre: e.nombre }), 'evento/' + e.slug, {
          imagen: e.fotos?.[0]?.url ?? null,
          idiomas: e.seo?.idiomasDisponibles,
        });
        this.seo.jsonLd(e.seo?.jsonLd);
      },
      error: (err) => {
        if (esNoEncontrado(err)) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        } else {
          this.fallo.set(true);
        }
        this.seo.pagina(this.i18n.t('noEncontrada'), this.i18n.t('noEncontradaTexto'), '', { noIndexar: true });
      },
    });
  }
}
