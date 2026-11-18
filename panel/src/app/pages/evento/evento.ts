import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import { ESTADOS_EVENTO, FormEvento, MAX_NEGOCIOS_EVENTO, errorDeEvento, estadoContenido, eventoParaApi, formDeEvento, formEventoVacio, idiomasConTexto } from '../../core/contenido';
import { Municipio } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/panel';
import { IdiomasPestanas } from '../../shared/idiomas-pestanas';
import { SelectorMapa } from '../../shared/selector-mapa';
import { SelectorMunicipio } from '../../shared/selector-municipio';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Un evento (nuevo en `/eventos/nuevo` o existente en `/eventos/:id`): fechas, sede, textos por idioma y negocios que participan. */
@Component({
  selector: 'app-evento',
  imports: [FormsModule, RouterLink, IdiomasPestanas, SelectorMapa, SelectorMunicipio, SelectorNegocio],
  templateUrl: './evento.html',
  styleUrl: './evento.scss',
})
export class Evento implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly cat = inject(Catalogos);

  protected readonly nuevo = computed(() => this.id() === 'nuevo');
  protected form: FormEvento = formEventoVacio();
  protected readonly version = signal(0);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal(false);
  protected readonly archivando = signal(false);
  protected readonly idioma = signal('es');
  protected readonly nombre = signal('');

  protected readonly estados = ESTADOS_EVENTO;
  protected readonly maxNegocios = MAX_NEGOCIOS_EVENTO;
  protected readonly estadoInfo = estadoContenido;
  protected readonly conTexto = computed(() => { this.version(); return idiomasConTexto(this.form.textos, (t) => t.nombre); });
  protected readonly idiomasConError = computed(() => Object.keys(this.errores()).filter((k) => /^(texto|nombre)-/.test(k)).map((k) => k.split('-')[1]));
  protected readonly textoActual = computed(() => { this.version(); return this.form.textos[this.idioma()] ?? (this.form.textos[this.idioma()] = { nombre: '', descripcion: '' }); });
  protected readonly centro = computed(() => { this.version(); const m = this.form.municipioId ? this.cat.municipiosPorId().get(this.form.municipioId) : null; return m ? { lat: m.latitud, lng: m.longitud } : { lat: null, lng: null }; });
  protected readonly gratis = computed(() => { this.version(); return this.form.gratis; });

  ngOnInit(): void {
    this.cat.cargar();
    const aviso = history.state?.['aviso'] as string | undefined;
    if (aviso) this.aviso.set(aviso);
    if (this.nuevo()) { this.cargando.set(false); return; }
    this.api.evento(this.id()).subscribe({
      next: (e) => {
        this.form = formDeEvento(e);
        this.nombre.set(e.traducciones?.['es']?.nombre ?? '');
        this.cargando.set(false);
        this.cambio();
        for (const n of this.form.negocios) this.api.negocio(n.id).subscribe({ next: (f) => { n.nombre = f.nombreComercial; this.cambio(); }, error: () => { n.nombre = 'Negocio'; this.cambio(); } });
      },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar este evento.')); this.cargando.set(false); },
    });
  }

  protected cambio(): void { this.version.update((n) => n + 1); }

  protected elegirMunicipio(m: Municipio | null): void {
    this.form.municipioId = m?.id ?? null;
    this.cambio();
  }

  protected marcarPunto(p: { latitud: number; longitud: number }): void {
    this.form.latitud = Math.round(p.latitud * 1e6) / 1e6;
    this.form.longitud = Math.round(p.longitud * 1e6) / 1e6;
    this.cambio();
  }

  protected quitarPunto(): void {
    this.form.latitud = null;
    this.form.longitud = null;
    this.cambio();
  }

  protected agregarNegocio(n: NegocioElegido | null): void {
    if (!n || this.form.negocios.some((x) => x.id === n.id)) return;
    this.form.negocios = [...this.form.negocios, { id: n.id, nombre: n.nombre }];
    this.cambio();
  }

  protected quitarNegocio(id: string): void {
    this.form.negocios = this.form.negocios.filter((n) => n.id !== id);
    this.cambio();
  }

  protected guardar(): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const errores = errorDeEvento(this.form);
    this.errores.set(errores);
    if (Object.keys(errores).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = eventoParaApi(this.form);
    const llamada = this.nuevo() ? this.api.crearEvento(cuerpo) : this.api.actualizarEvento(this.id(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        if (this.nuevo() && r.datos) { void this.router.navigate(['/eventos', r.datos.id], { state: { aviso: 'Evento creado.' } }); return; }
        this.aviso.set('Evento guardado.');
        this.nombre.set(this.form.textos['es']?.nombre ?? '');
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApi.set(er.general);
        if (er.campos) this.errores.set(er.campos);
      },
    });
  }

  protected archivar(): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.api.archivarContenido('eventos', this.id()).subscribe({
      next: () => void this.router.navigate(['/eventos']),
      error: (e) => { this.trabajando.set(false); this.archivando.set(false); this.errorApi.set(leerError(e).general); },
    });
  }
}
