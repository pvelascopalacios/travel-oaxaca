import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import {
  FormGeo, FormNombres, GRUPOS_SERVICIO, categoriasEnFilas, errorDeGeo, errorDeNombres, formGeoVacio, formNombresVacio, grupoServicioTexto, nombresParaApi, numeroONull,
} from '../../core/contenido';
import { CategoriaCatalogo, Localidad, Municipio, ServicioCatalogo } from '../../core/modelos';
import { ErrorApi, leerError, tieneAlgunRol } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { SelectorMunicipio } from '../../shared/selector-municipio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

type Pestana = 'categorias' | 'servicios' | 'municipios' | 'localidades';

/** Categorías, servicios, municipios y localidades. Solo admin toca los tres primeros; el editor, las localidades. */
@Component({
  selector: 'app-catalogos',
  imports: [FormsModule, SelectorMunicipio],
  templateUrl: './catalogos.html',
  styleUrl: './catalogos.scss',
})
export class CatalogosPagina implements OnInit {
  /** /catalogos?tab=categorias|servicios|municipios|localidades&region=<id>&municipio=<id> */
  readonly tab = input<string>();
  readonly region = input<string>();
  readonly municipio = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly cat = inject(Catalogos);
  private readonly sesion = inject(Sesion);

  protected readonly esAdmin = computed(() => tieneAlgunRol(this.sesion.usuario()?.roles, ['admin']));
  protected readonly pestanas = computed(() => (this.esAdmin()
    ? [{ c: 'categorias', t: 'Categorías' }, { c: 'servicios', t: 'Servicios' }, { c: 'municipios', t: 'Municipios' }, { c: 'localidades', t: 'Localidades' }]
    : [{ c: 'localidades', t: 'Localidades' }]) as { c: Pestana; t: string }[]);
  protected readonly actual = computed<Pestana>(() => {
    const t = this.tab() as Pestana;
    return this.pestanas().some((p) => p.c === t) ? t : this.pestanas()[0].c;
  });

  protected readonly grupos = GRUPOS_SERVICIO;
  protected readonly grupoTexto = grupoServicioTexto;
  protected readonly trabajando = signal(false);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly errores = signal<Record<string, string>>({});
  /** Qué se está creando o editando ahora: 'nuevo' o el id. */
  protected readonly editando = signal<string | null>(null);

  protected readonly categorias = signal<CategoriaCatalogo[] | null>(null);
  protected readonly filasCategorias = computed(() => categoriasEnFilas(this.categorias() ?? []));
  protected readonly servicios = signal<ServicioCatalogo[] | null>(null);
  protected readonly localidades = signal<Localidad[] | null>(null);
  protected readonly municipiosDeRegion = computed<Municipio[]>(() => {
    const r = this.region() || this.cat.regiones()[0]?.id;
    return this.cat.municipios().filter((m) => m.regionId === r);
  });
  protected readonly regionActual = computed(() => this.region() || this.cat.regiones()[0]?.id || '');

  protected formNom: FormNombres = formNombresVacio();
  protected formGeo: FormGeo = formGeoVacio();
  protected readonly municipioLoc = computed(() => this.municipio() ?? null);
  protected readonly regionDe = (m: Municipio): string => this.cat.regiones().find((r) => r.id === m.regionId)?.nombre ?? '';

  ngOnInit(): void {
    this.cat.cargar();
    this.cargarCategorias();
    this.cargarServicios();
    if (this.municipio()) this.cargarLocalidades(this.municipio()!);
  }

  protected irA(t: Pestana): void {
    this.cancelar();
    void this.router.navigate([], { queryParams: { tab: t, region: null, municipio: t === 'localidades' ? this.municipio() ?? null : null } });
  }

  private cargarCategorias(): void {
    if (!this.esAdmin()) return;
    this.api.categoriasCatalogo().subscribe({ next: (l) => this.categorias.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar las categorías.')) });
  }
  private cargarServicios(): void {
    if (!this.esAdmin()) return;
    this.api.serviciosCatalogo().subscribe({ next: (l) => this.servicios.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar los servicios.')) });
  }
  protected cargarLocalidades(id: string): void {
    this.localidades.set(null);
    this.api.localidades(id).subscribe({ next: (l) => this.localidades.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar las localidades.')) });
  }

  protected elegirRegion(id: string): void {
    this.cancelar();
    void this.router.navigate([], { queryParams: { tab: 'municipios', region: id }, queryParamsHandling: 'merge' });
  }

  protected elegirMunicipioLoc(m: Municipio | null): void {
    this.cancelar();
    this.localidades.set(null);
    void this.router.navigate([], { queryParams: { tab: 'localidades', municipio: m?.id ?? null }, queryParamsHandling: 'merge' });
    if (m) this.cargarLocalidades(m.id);
  }

  // ---------- formularios ----------
  protected cancelar(): void {
    this.editando.set(null);
    this.errores.set({});
    this.errorApi.set(null);
  }

  protected nuevo(): void {
    this.aviso.set(null);
    this.cancelar();
    this.formNom = formNombresVacio();
    this.formGeo = { ...formGeoVacio(), regionId: this.regionActual() };
    this.editando.set('nuevo');
  }

  protected editarCategoria(c: CategoriaCatalogo): void {
    this.aviso.set(null);
    this.cancelar();
    this.formNom = { ...formNombresVacio(), clave: c.clave, icono: c.icono ?? '', orden: String(c.orden ?? ''), padreId: c.padreId ?? '', nombres: { es: c.nombre } };
    this.editando.set(c.id);
  }

  protected editarServicio(s: ServicioCatalogo): void {
    this.aviso.set(null);
    this.cancelar();
    this.formNom = { ...formNombresVacio(), clave: s.clave, grupo: s.grupo, icono: s.icono ?? '', nombres: { es: s.nombre } };
    this.editando.set(s.id);
  }

  protected editarMunicipio(m: Municipio): void {
    this.aviso.set(null);
    this.cancelar();
    this.formGeo = { nombre: m.nombre, claveInegi: m.claveInegi ?? '', latitud: m.latitud === null ? '' : String(m.latitud), longitud: m.longitud === null ? '' : String(m.longitud), activo: true, regionId: m.regionId };
    this.editando.set(m.id);
  }

  protected editarLocalidad(l: Localidad): void {
    this.aviso.set(null);
    this.cancelar();
    this.formGeo = { ...formGeoVacio(), nombre: l.nombre, latitud: l.latitud === null ? '' : String(l.latitud), longitud: l.longitud === null ? '' : String(l.longitud) };
    this.editando.set(l.id);
  }

  protected nombreIdioma(c: string): string {
    return this.cat.idiomas().find((i) => i.codigo === c)?.nombre ?? c;
  }

  protected guardar(): void {
    if (this.trabajando() || !this.editando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const id = this.editando()!;
    const creando = id === 'nuevo';
    const t = this.actual();
    const conNombres = t === 'categorias' || t === 'servicios';
    const errores = conNombres ? errorDeNombres(this.formNom, creando, t === 'servicios') : errorDeGeo(this.formGeo, t === 'municipios');
    if (t === 'localidades' && !this.municipio()) errores['municipio'] = 'Elige el municipio.';
    this.errores.set(errores);
    if (Object.keys(errores).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const f = this.formNom, g = this.formGeo;
    const lat = numeroONull(g.latitud), lng = numeroONull(g.longitud);
    let llamada: Observable<{ mensajes?: string[] }>;
    if (t === 'categorias') {
      const cuerpo = { padreId: f.padreId || null, clave: f.clave.trim(), icono: f.icono.trim() || null, orden: f.orden.trim() ? Number(f.orden) : null, activa: f.activo, nombres: nombresParaApi(f.nombres) };
      llamada = creando ? this.api.crearCategoria(cuerpo) : this.api.actualizarCategoria(id, cuerpo);
    } else if (t === 'servicios') {
      const cuerpo = { clave: f.clave.trim(), grupo: f.grupo, icono: f.icono.trim() || null, activo: f.activo, nombres: nombresParaApi(f.nombres) };
      llamada = creando ? this.api.crearServicio(cuerpo) : this.api.actualizarServicio(id, cuerpo);
    } else if (t === 'municipios') {
      const cuerpo = { regionId: g.regionId, claveInegi: g.claveInegi.trim() || null, nombre: g.nombre.trim(), latitud: lat, longitud: lng, activo: g.activo };
      llamada = creando ? this.api.crearMunicipio(cuerpo) : this.api.actualizarMunicipio(id, cuerpo);
    } else {
      const cuerpo = { municipioId: this.municipio()!, nombre: g.nombre.trim(), latitud: lat, longitud: lng, activo: g.activo };
      llamada = creando ? this.api.crearLocalidad(cuerpo) : this.api.actualizarLocalidad(id, cuerpo);
    }
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.editando.set(null);
        this.aviso.set(r.mensajes?.[0] ?? 'Guardado.');
        if (t === 'categorias') this.cargarCategorias();
        else if (t === 'servicios') this.cargarServicios();
        else if (t === 'municipios') this.cat.recargarMunicipios();
        else this.cargarLocalidades(this.municipio()!);
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApi.set(er.general);
        if (er.campos) this.errores.set(er.campos);
      },
    });
  }
}
