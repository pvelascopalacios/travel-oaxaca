import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { esNoEncontrado } from '../../core/ficha';
import { I18n } from '../../core/i18n';
import { GrupoDia, agruparPorDia, claveTipoElemento, diasDeItinerario, rangoFechas, rutaDeElemento } from '../../core/listas';
import { ListaDetalle, ListaElemento } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Imagen } from '../../shared/imagen';
import { NoExiste } from '../../shared/no-existe';

/** Una lista o itinerario que alguien compartió. Solo lectura y sin pedir sesión. */
@Component({
  selector: 'app-lista-publica',
  imports: [RouterLink, Imagen, NoExiste],
  templateUrl: './lista-publica.html',
  styleUrls: ['../listas/listas.scss', '../mi-lista/mi-lista.scss'],
})
export class ListaPublica implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly lista = signal<ListaDetalle | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);
  private id = '';

  protected readonly grupos = computed<GrupoDia[]>(() => {
    const l = this.lista();
    return l ? agruparPorDia(l.elementos, l.esItinerario, l.fechaInicio, l.fechaFin) : [];
  });

  ngOnInit(): void {
    this.id = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.cargar();
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.listaPublica(this.id).subscribe({
      next: (l) => {
        this.lista.set(l);
        this.seo.pagina(l.nombre, this.i18n.t('listasSeo'), `lista/${this.id}`, { noIndexar: true });
      },
      error: (e) => {
        if (esNoEncontrado(e)) {
          this.noExiste.set(true);
          this.seo.pagina(this.i18n.t('listaNoExiste'), this.i18n.t('listasSeo'), `lista/${this.id}`, { noIndexar: true });
          if (this.respuesta) this.respuesta.status = 404;
        } else this.fallo.set(true);
      },
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
    if (l.autorNombre) partes.push(this.i18n.tf('listaDeAutor', { nombre: l.autorNombre }));
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
