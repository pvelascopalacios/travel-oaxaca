import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import {
  DIFICULTADES_RUTA, ESTADOS_RUTA, FormRuta, MAX_PARADAS, ParadaForm, TRANSPORTES_RUTA, errorDeParada, errorDeRuta, estadoContenido, formDeRuta, formRutaVacio, idiomasConTexto, moverElemento, rutaParaApi,
} from '../../core/contenido';
import { ErrorApi, leerError } from '../../core/panel';
import { IdiomasPestanas } from '../../shared/idiomas-pestanas';
import { Opcion, SelectorBusqueda } from '../../shared/selector-busqueda';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Una ruta (nueva en `/rutas/nuevo` o existente en `/rutas/:id`): datos, textos por idioma y paradas en orden. */
@Component({
  selector: 'app-ruta',
  imports: [FormsModule, RouterLink, IdiomasPestanas, SelectorBusqueda, SelectorNegocio],
  templateUrl: './ruta.html',
  styleUrl: './ruta.scss',
})
export class Ruta implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly cat = inject(Catalogos);

  protected readonly nuevo = computed(() => this.id() === 'nuevo');
  protected form: FormRuta = formRutaVacio();
  protected readonly paradas = signal<ParadaForm[]>([]);
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
  protected readonly agregando = signal<'lugar' | 'negocio' | null>(null);

  protected readonly estados = ESTADOS_RUTA;
  protected readonly dificultades = DIFICULTADES_RUTA;
  protected readonly transportes = TRANSPORTES_RUTA;
  protected readonly maxParadas = MAX_PARADAS;
  protected readonly estadoInfo = estadoContenido;
  protected readonly conTexto = computed(() => { this.version(); return idiomasConTexto(this.form.textos, (t) => t.nombre); });
  protected readonly idiomasConError = computed(() => Object.keys(this.errores()).filter((k) => /^(texto|nombre)-/.test(k)).map((k) => k.split('-')[1]));
  protected readonly textoActual = computed(() => { this.version(); return this.form.textos[this.idioma()] ?? (this.form.textos[this.idioma()] = { nombre: '', descripcion: '' }); });
  protected readonly errorDeParada = errorDeParada;

  protected readonly buscarLugares = (texto: string) =>
    this.api.contenidos('lugares', { q: texto, tamano: 6 }).pipe(map((p) => p.elementos.map((l): Opcion => ({ id: l.id, nombre: l.nombre }))));

  ngOnInit(): void {
    this.cat.cargar();
    const aviso = history.state?.['aviso'] as string | undefined;
    if (aviso) this.aviso.set(aviso);
    if (this.nuevo()) { this.cargando.set(false); return; }
    this.api.ruta(this.id()).subscribe({
      next: (r) => {
        this.form = formDeRuta(r);
        this.nombre.set(r.traducciones?.['es']?.nombre ?? '');
        this.paradas.set(this.form.paradas);
        this.cargando.set(false);
        this.cambio();
        this.form.paradas.forEach((p) => this.ponerNombre(p));
      },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar esta ruta.')); this.cargando.set(false); },
    });
  }

  private ponerNombre(p: ParadaForm): void {
    const listo = () => this.paradas.update((l) => [...l]);
    if (p.lugarId) this.api.lugar(p.lugarId).subscribe({ next: (l) => { p.nombre = l.traducciones?.['es']?.nombre ?? 'Lugar'; listo(); }, error: () => { p.nombre = 'Lugar'; listo(); } });
    else if (p.negocioId) this.api.negocio(p.negocioId).subscribe({ next: (n) => { p.nombre = n.nombreComercial; listo(); }, error: () => { p.nombre = 'Negocio'; listo(); } });
  }

  protected cambio(): void { this.version.update((n) => n + 1); }

  protected agregarLugar(o: Opcion | null): void {
    if (!o) return;
    this.paradas.update((l) => [...l, { tipo: 'lugar', lugarId: o.id, negocioId: null, nombre: o.nombre, latitud: '', longitud: '', minutos: '' }]);
    this.agregando.set(null);
  }

  protected agregarNegocio(n: NegocioElegido | null): void {
    if (!n) return;
    this.paradas.update((l) => [...l, { tipo: 'negocio', lugarId: null, negocioId: n.id, nombre: n.nombre, latitud: '', longitud: '', minutos: '' }]);
    this.agregando.set(null);
  }

  protected agregarPunto(): void {
    this.paradas.update((l) => [...l, { tipo: 'punto', lugarId: null, negocioId: null, nombre: '', latitud: '', longitud: '', minutos: '' }]);
    this.agregando.set(null);
  }

  protected mover(i: number, d: number): void { this.paradas.update((l) => moverElemento(l, i, i + d)); }
  protected quitar(i: number): void { this.paradas.update((l) => l.filter((_, k) => k !== i)); }

  protected guardar(): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    this.form.paradas = this.paradas();
    const errores = errorDeRuta(this.form);
    this.errores.set(errores);
    if (Object.keys(errores).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = rutaParaApi(this.form);
    const llamada = this.nuevo() ? this.api.crearRuta(cuerpo) : this.api.actualizarRuta(this.id(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        if (this.nuevo() && r.datos) { void this.router.navigate(['/rutas', r.datos.id], { state: { aviso: 'Ruta creada.' } }); return; }
        this.aviso.set('Ruta guardada.');
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
    this.api.archivarContenido('rutas', this.id()).subscribe({
      next: () => void this.router.navigate(['/rutas']),
      error: (e) => { this.trabajando.set(false); this.archivando.set(false); this.errorApi.set(leerError(e).general); },
    });
  }
}
