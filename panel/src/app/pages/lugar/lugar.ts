import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import {
  DIAS_SEMANA, ESTADOS_GENERALES, FormLugar, TIPOS_LUGAR, errorDeLugar, estadoContenido, formDeLugar, formLugarVacio, idiomasConTexto, lugarParaApi, moverElemento, textoLugarVacio,
} from '../../core/contenido';
import { Municipio } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/panel';
import { IdiomasPestanas } from '../../shared/idiomas-pestanas';
import { SelectorBusqueda, Opcion } from '../../shared/selector-busqueda';
import { SelectorMapa } from '../../shared/selector-mapa';
import { SelectorMunicipio } from '../../shared/selector-municipio';
import { FotoSubida, SubirFoto } from '../../shared/subir-foto';
import { enlazarAviso, enlazarError } from '../../core/avisos';

interface FotoLugar {
  medioId: string;
  url: string | null;
}
const MAX_FOTOS = 20;

/** Un lugar (nuevo en `/lugares/nuevo` o existente en `/lugares/:id`): datos, textos por idioma, mapa y fotos. */
@Component({
  selector: 'app-lugar',
  imports: [FormsModule, RouterLink, IdiomasPestanas, SelectorBusqueda, SelectorMapa, SelectorMunicipio, SubirFoto],
  templateUrl: './lugar.html',
  styleUrl: './lugar.scss',
})
export class Lugar implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly cat = inject(Catalogos);

  protected readonly nuevo = computed(() => this.id() === 'nuevo');
  protected form: FormLugar = formLugarVacio();
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

  // fotos
  protected readonly fotos = signal<FotoLugar[]>([]);
  protected readonly fotosSucias = signal(false);
  protected readonly errorFotos = signal<string | null>(null);
  protected readonly avisoFotos = signal<string | null>(null);
  protected readonly cupo = computed(() => MAX_FOTOS - this.fotos().length);

  protected readonly tipos = TIPOS_LUGAR;
  protected readonly estados = ESTADOS_GENERALES;
  protected readonly dias = DIAS_SEMANA;
  protected readonly estadoInfo = estadoContenido;
  protected readonly conTexto = computed(() => { this.version(); return idiomasConTexto(this.form.textos, (t) => t.nombre); });
  protected readonly idiomasConError = computed(() => Object.keys(this.errores()).filter((k) => /^(texto|nombre)-/.test(k)).map((k) => k.split('-')[1]));
  protected readonly textoActual = computed(() => { this.version(); return this.form.textos[this.idioma()] ?? (this.form.textos[this.idioma()] = textoLugarVacio()); });
  protected readonly centro = computed(() => { this.version(); const m = this.form.municipioId ? this.cat.municipiosPorId().get(this.form.municipioId) : null; return m ? { lat: m.latitud, lng: m.longitud } : { lat: null, lng: null }; });
  protected readonly padre = computed<Opcion | null>(() => { this.version(); return this.form.padreId ? { id: this.form.padreId, nombre: this.form.padreNombre || 'Lugar elegido' } : null; });
  protected readonly esGratis = computed(() => { this.version(); return this.form.entrada === 'gratis'; });
  protected readonly conCosto = computed(() => { this.version(); return this.form.entrada === 'con_costo'; });

  protected readonly buscarLugares = (texto: string) =>
    this.api.contenidos('lugares', { q: texto, tamano: 6 }).pipe(map((p) => p.elementos.filter((l) => l.id !== this.id()).map((l): Opcion => ({ id: l.id, nombre: l.nombre }))));

  ngOnInit(): void {
    this.cat.cargar();
    const aviso = history.state?.['aviso'] as string | undefined;
    if (aviso) this.aviso.set(aviso);
    if (this.nuevo()) { this.cargando.set(false); return; }
    this.api.lugar(this.id()).subscribe({
      next: (l) => {
        this.form = formDeLugar(l);
        this.nombre.set(l.traducciones?.['es']?.nombre ?? '');
        this.fotos.set((l.medioIds ?? []).map((medioId) => ({ medioId, url: null })));
        this.cargando.set(false);
        this.cambio();
        if (l.padreId) this.api.lugar(l.padreId).subscribe({ next: (p) => { this.form.padreNombre = p.traducciones?.['es']?.nombre ?? ''; this.cambio(); }, error: () => undefined });
      },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar este lugar.')); this.cargando.set(false); },
    });
  }

  protected cambio(): void { this.version.update((n) => n + 1); }

  protected elegirMunicipio(m: Municipio | null): void {
    this.form.municipioId = m?.id ?? null;
    this.cambio();
  }

  protected elegirPadre(o: Opcion | null): void {
    this.form.padreId = o?.id ?? null;
    this.form.padreNombre = o?.nombre ?? '';
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

  protected alternarDia(n: number, marcado: boolean): void {
    this.form.dias = marcado ? [...new Set([...this.form.dias, n])].sort((a, b) => a - b) : this.form.dias.filter((d) => d !== n);
    this.cambio();
  }

  protected guardar(): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const errores = errorDeLugar(this.form);
    this.errores.set(errores);
    if (Object.keys(errores).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = lugarParaApi(this.form);
    const llamada = this.nuevo() ? this.api.crearLugar(cuerpo) : this.api.actualizarLugar(this.id(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        if (this.nuevo() && r.datos) { void this.router.navigate(['/lugares', r.datos.id], { state: { aviso: 'Lugar creado. Ahora puedes agregar sus fotos.' } }); return; }
        this.aviso.set('Lugar guardado.');
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
    this.api.archivarContenido('lugares', this.id()).subscribe({
      next: () => void this.router.navigate(['/lugares']),
      error: (e) => { this.trabajando.set(false); this.archivando.set(false); this.errorApi.set(leerError(e).general); },
    });
  }

  // ---------- fotos ----------
  protected fotoLista(f: FotoSubida): void {
    this.fotos.update((l) => (l.length >= MAX_FOTOS ? l : [...l, { medioId: f.medioId, url: f.url }]));
    this.fotosSucias.set(true);
    this.avisoFotos.set(null);
  }

  protected moverFoto(i: number, d: number): void {
    this.fotos.update((l) => moverElemento(l, i, i + d));
    this.fotosSucias.set(true);
  }

  protected quitarFoto(i: number): void {
    this.fotos.update((l) => l.filter((_, k) => k !== i));
    this.fotosSucias.set(true);
  }

  protected guardarFotos(): void {
    if (this.trabajando()) return;
    this.errorFotos.set(null);
    this.avisoFotos.set(null);
    this.trabajando.set(true);
    this.api.fotosLugar(this.id(), this.fotos().map((f) => f.medioId)).subscribe({
      next: () => { this.trabajando.set(false); this.fotosSucias.set(false); this.avisoFotos.set('Fotos guardadas.'); },
      error: (e) => { this.trabajando.set(false); this.errorFotos.set(leerError(e).general); },
    });
  }
}
