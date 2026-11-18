import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OperatorFunction, catchError, of } from 'rxjs';
import { Api } from '../../core/api';
import { hoyMx } from '../../core/filtros';
import { I18n } from '../../core/i18n';
import { EventoTarjeta, LugarTarjeta, NegocioTarjeta, Pagina, Region as RegionModelo } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { TarjetaEvento } from '../../shared/tarjeta-evento';
import { TarjetaLugar } from '../../shared/tarjeta-lugar';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';

const vacia = <T>(): Pagina<T> => ({ elementos: [], total: 0, pagina: 1, tamano: 0 });

/** Una región de Oaxaca: lugares, negocios mejor calificados y próximos eventos de esa zona. */
@Component({
  selector: 'app-region',
  imports: [RouterLink, TarjetaLugar, TarjetaNegocio, TarjetaEvento],
  templateUrl: './region.html',
  styleUrl: './region.scss',
})
export class Region implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly region = signal<RegionModelo | null>(null);
  protected readonly lugares = signal<LugarTarjeta[]>([]);
  protected readonly negocios = signal<NegocioTarjeta[]>([]);
  protected readonly eventos = signal<EventoTarjeta[]>([]);
  protected readonly cargando = signal(true);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);

  protected readonly vacia = computed(() => !this.cargando() && !this.lugares().length && !this.negocios().length && !this.eventos().length);

  ngOnInit(): void {
    const slug = this.ruta.snapshot.paramMap.get('slug') ?? '';
    this.api.regiones().pipe(catchError(() => { this.fallo.set(true); return of([] as RegionModelo[]); })).subscribe((todas) => {
      const r = todas.find((x) => x.slug === slug) ?? null;
      if (!r) {
        this.cargando.set(false);
        // Si la API falló no sabemos si existe: no se marca como 404 para no sacarla del buscador por un tropiezo.
        if (!this.fallo()) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        }
        this.seo.pagina(this.i18n.t('noEncontrada'), this.i18n.t('noEncontradaTexto'), '', { noIndexar: true });
        return;
      }
      this.region.set(r);
      this.seo.pagina(r.nombre, this.i18n.tf('regionSeo', { nombre: r.nombre }), 'region/' + r.slug, { imagen: r.portadaUrl });
      let pendientes = 3;
      const listo = () => { if (--pendientes === 0) this.cargando.set(false); };
      const fallar = <T>(): OperatorFunction<Pagina<T>, Pagina<T>> => catchError(() => { this.fallo.set(true); return of(vacia<T>()); });
      this.api.lugares({ regionId: r.id, tamano: 8 }).pipe(fallar<LugarTarjeta>()).subscribe((p) => { this.lugares.set(p.elementos); listo(); });
      this.api.negocios({ regionId: r.id, orden: 'calificacion', tamano: 8 }).pipe(fallar<NegocioTarjeta>()).subscribe((p) => { this.negocios.set(p.elementos); listo(); });
      this.api.eventos({ regionId: r.id, desde: hoyMx(), tamano: 4 }).pipe(fallar<EventoTarjeta>()).subscribe((p) => { this.eventos.set(p.elementos); listo(); });
    });
  }

  protected cuenta(r: RegionModelo): string[] {
    const n = (v: number) => v.toLocaleString(this.i18n.lang() === 'es' ? 'es-MX' : 'en-US');
    const partes: string[] = [];
    if (r.totalLugares) partes.push(this.i18n.tf('lugaresN', { n: n(r.totalLugares) }));
    if (r.totalNegocios) partes.push(this.i18n.tf('negociosN', { n: n(r.totalNegocios) }));
    return partes;
  }
}
