import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { comoLlegarUrl, esNoEncontrado, parrafos } from '../../core/ficha';
import { I18n } from '../../core/i18n';
import { LugarPublico } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Comentarios } from '../../shared/comentarios';
import { Galeria } from '../../shared/galeria';
import { Guardar } from '../../shared/guardar';
import { GuardarEnLista } from '../../shared/guardar-en-lista';
import { Mapa, Pin } from '../../shared/mapa';
import { NoExiste } from '../../shared/no-existe';
import { TarjetaLugar } from '../../shared/tarjeta-lugar';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';

interface Dato {
  etiqueta: string;
  valor: string;
}

/** Ficha de un lugar: historia, recomendaciones, datos prácticos, cómo llegar, qué ver y negocios cercanos. */
@Component({
  selector: 'app-lugar',
  imports: [Comentarios, RouterLink, Galeria, Guardar, GuardarEnLista, Mapa, NoExiste, TarjetaLugar, TarjetaNegocio],
  templateUrl: './lugar.html',
  styleUrl: '../ficha.scss',
})
export class Lugar implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly l = signal<LugarPublico | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);

  protected readonly pines = computed<Pin[]>(() => {
    const l = this.l();
    return l && l.latitud != null && l.longitud != null ? [{ id: l.id, slug: l.slug, nombre: l.nombre, lat: l.latitud, lng: l.longitud, etiqueta: '' }] : [];
  });
  protected readonly llegar = computed(() => {
    const l = this.l();
    return l && l.latitud != null && l.longitud != null ? comoLlegarUrl(l.latitud, l.longitud) : null;
  });
  /** Solo se muestran los que tienen foto; si ninguno la tiene, la sección completa se oculta. */
  protected readonly atractivosConFoto = computed(() => (this.l()?.atractivos ?? []).filter((a) => !!a.portadaUrl));
  protected readonly cercanosConFoto = computed(() => (this.l()?.negociosCercanos ?? []).filter((n) => !!n.portadaUrl));
  protected readonly resumen = computed(() => parrafos(this.l()?.resumen));
  protected readonly historia = computed(() => parrafos(this.l()?.historia));
  protected readonly recomendaciones = computed(() => parrafos(this.l()?.recomendaciones));
  protected readonly comoLlegarTexto = computed(() => parrafos(this.l()?.comoLlegar));
  protected readonly datos = computed<Dato[]>(() => this.armarDatos());

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((p) => this.cargar(p.get('slug') ?? ''));
  }

  private cargar(slug: string): void {
    this.l.set(null);
    this.noExiste.set(false);
    this.fallo.set(false);
    this.api.lugar(slug).subscribe({
      next: (l) => {
        this.l.set(l);
        this.seo.pagina(l.seo?.titulo || l.nombre, l.seo?.descripcion || l.resumen || '', 'lugar/' + l.slug, {
          imagen: l.fotos[0]?.url ?? null,
          idiomas: l.seo?.idiomasDisponibles,
        });
        this.seo.jsonLd(l.seo?.jsonLd);
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

  private armarDatos(): Dato[] {
    const d = this.l()?.datos;
    if (!d) return [];
    const t = (c: Parameters<I18n['t']>[0]) => this.i18n.t(c);
    const out: Dato[] = [];
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
    const dinero = (v: unknown) => (typeof v === 'number' ? (v === 0 ? t('gratis') : this.i18n.precio(v, 'MXN')) : texto(v));
    const poner = (etiqueta: string, valor: string | null) => {
      if (valor) out.push({ etiqueta, valor });
    };
    if (d['entrada'] === 'gratis') poner(t('lugarEntrada'), t('gratis'));
    else if (d['entrada'] === 'con_costo') poner(t('lugarEntrada'), t('entradaConCosto'));
    poner(t('costoNacional'), dinero(d['costoNacional']));
    poner(t('costoExtranjero'), dinero(d['costoExtranjero']));
    poner(t('diasAbierto'), texto(d['diasAbierto']));
    poner(t('horario'), texto(d['horarioTexto']));
    if (d['accesible'] === true) poner(t('accesible'), '✓');
    const dif = texto(d['dificultad']);
    poner(t('dificultad'), dif ? this.i18n.tDinamico('dificultad', dif) : null);
    poner(t('mejorEpoca'), texto(this.l()?.mejorEpoca));
    return out;
  }
}
