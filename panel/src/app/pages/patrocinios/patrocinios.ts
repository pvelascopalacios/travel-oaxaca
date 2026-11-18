import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Categoria, Destino, Espacio, Patrocinio, Region } from '../../core/modelos';
import { ESPACIOS, METODOS_PAGO, FormEspacio, FormPatrocinio, errorDeEspacio, errorDePatrocinio, espacioParaApi, espacioTexto, estadoPatrocinio, filasCalendario, formDeEspacio, formEspacioVacio, formPatrocinioVacio, patrocinioParaApi, puedeCancelarPatrocinio, sumaDias } from '../../core/operacion';
import { ErrorApi, categoriasPlanas, fechaCorta, leerError } from '../../core/panel';
import { hoyISO } from '../../core/ventas';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Calendario de patrocinios por espacio, programar y cancelar. Administración y ventas también editan los espacios y su cupo. */
@Component({
  selector: 'app-patrocinios',
  imports: [FormsModule, DecimalPipe, SelectorNegocio],
  templateUrl: './patrocinios.html',
  styleUrl: './patrocinios.scss',
})
export class Patrocinios implements OnInit {
  private readonly api = inject(Api);
  protected readonly claves = ESPACIOS;
  protected readonly metodos = METODOS_PAGO;
  protected readonly estadoInfo = estadoPatrocinio;
  protected readonly puedeCancelar = puedeCancelarPatrocinio;
  protected readonly nombreEspacio = espacioTexto;
  protected readonly fecha = fechaCorta;

  protected desde = hoyISO();
  protected hasta = sumaDias(hoyISO(), 59);
  protected soloVigentes = true;
  protected filtroEspacio = '';

  protected readonly espacios = signal<Espacio[] | null>(null);
  protected readonly lista = signal<Patrocinio[] | null>(null);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly rango = signal({ desde: this.desde, hasta: this.hasta });
  protected readonly filas = computed(() => filasCalendario(this.lista() ?? [], this.rango().desde, this.rango().hasta));
  /** Etiquetas de semana sobre el calendario. */
  protected readonly marcas = computed(() => {
    const { desde, hasta } = this.rango();
    const total = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1;
    const m: { izq: number; texto: string }[] = [];
    for (let d = 0; d < total; d += 7) m.push({ izq: (d / total) * 100, texto: fechaCorta(sumaDias(desde, d), { day: 'numeric', month: 'short' }) });
    return m;
  });
  protected readonly cupo = (id: string): number | null => this.espacios()?.find((e) => e.id === id)?.maxSimultaneos ?? null;
  protected readonly etiquetaEspacio = (e: Espacio): string => `${espacioTexto(e.clave)}${this.alcance(e) ? ' · ' + this.alcance(e) : ''}`;

  protected readonly regiones = signal<Region[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly categorias = signal<{ id: string; etiqueta: string }[]>([]);

  // detalle
  protected readonly elegido = signal<Patrocinio | null>(null);
  protected readonly confirmandoCancelar = signal(false);
  protected readonly trabajando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);

  // programar
  protected readonly abierto = signal(false);
  protected form: FormPatrocinio = formPatrocinioVacio();
  protected readonly version = signal(0);
  protected readonly negocioElegido = computed<NegocioElegido | null>(() => { this.version(); return this.form.negocioId ? { id: this.form.negocioId, nombre: this.form.negocioNombre } : null; });
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());

  // espacios
  protected readonly editandoEspacio = signal<string | null>(null);
  protected formEspacio: FormEspacio = formEspacioVacio();
  protected readonly erroresEspacio = signal<Record<string, string>>({});
  protected readonly errorEspacio = signal<string | null>(null);

  ngOnInit(): void {
    this.api.regiones().subscribe({ next: (r) => this.regiones.set(r), error: () => undefined });
    this.api.destinos().subscribe({ next: (r) => this.destinos.set(r), error: () => undefined });
    this.api.categorias().subscribe({ next: (r: Categoria[]) => this.categorias.set(categoriasPlanas(r)), error: () => undefined });
    this.cargarEspacios();
    this.cargar();
  }

  protected alcance(e: Espacio): string {
    const p = [
      this.destinos().find((d) => d.id === e.destinoId)?.nombre,
      this.categorias().find((c) => c.id === e.categoriaId)?.etiqueta.trim(),
      this.regiones().find((r) => r.id === e.regionId)?.nombre,
    ].filter(Boolean);
    return p.join(' · ');
  }

  protected cargarEspacios(): void {
    this.api.espacios().subscribe({ next: (l) => this.espacios.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar los espacios.')) });
  }

  protected cargar(): void {
    this.fallo.set(null);
    if (!this.desde || !this.hasta || this.desde > this.hasta) { this.fallo.set({ general: 'La fecha inicial debe ser anterior o igual a la final.', campos: {} }); return; }
    this.lista.set(null);
    this.api.calendarioPatrocinios({ desde: this.desde, hasta: this.hasta, espacioId: this.filtroEspacio || null, soloVigentes: this.soloVigentes }).subscribe({
      next: (l) => { this.rango.set({ desde: this.desde, hasta: this.hasta }); this.lista.set(l); },
      error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar el calendario.')),
    });
  }

  protected elegir(p: Patrocinio): void {
    this.elegido.set(this.elegido()?.id === p.id ? null : p);
    this.confirmandoCancelar.set(false);
    this.errorAccion.set(null);
  }

  protected cancelar(): void {
    const p = this.elegido();
    if (!p || this.trabajando()) return;
    this.trabajando.set(true);
    this.errorAccion.set(null);
    this.api.cancelarPatrocinio(p.id).subscribe({
      next: (r) => { this.trabajando.set(false); this.confirmandoCancelar.set(false); this.elegido.set(null); this.aviso.set(r.mensajes?.[0] ?? 'Patrocinio cancelado.'); this.cargar(); },
      error: (e) => { this.trabajando.set(false); this.errorAccion.set(leerError(e).general); },
    });
  }

  // ---- programar ----
  protected abrirForm(): void {
    this.aviso.set(null);
    this.form = formPatrocinioVacio(hoyISO());
    this.errores.set({});
    this.errorApi.set(null);
    this.abierto.set(true);
    this.version.update((n) => n + 1);
  }
  protected elegirNegocio(n: NegocioElegido | null): void {
    this.form.negocioId = n?.id ?? '';
    this.form.negocioNombre = n?.nombre ?? '';
    this.version.update((x) => x + 1);
  }
  protected programar(): void {
    if (this.trabajando()) return;
    this.errorApi.set(null);
    const e = errorDePatrocinio(this.form);
    this.errores.set(e);
    if (Object.keys(e).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    this.api.crearPatrocinio(patrocinioParaApi(this.form)).subscribe({
      next: (r) => { this.trabajando.set(false); this.abierto.set(false); this.aviso.set(r.mensajes?.[0] ?? 'Patrocinio programado.'); this.cargar(); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.general); if (x.campos) this.errores.set(x.campos); },
    });
  }

  // ---- espacios (admin) ----
  protected nuevoEspacio(): void { this.abrirEspacio('nuevo', formEspacioVacio()); }
  protected editarEspacio(e: Espacio): void { this.abrirEspacio(e.id, formDeEspacio(e)); }
  private abrirEspacio(id: string, f: FormEspacio): void {
    this.aviso.set(null);
    this.formEspacio = f;
    this.erroresEspacio.set({});
    this.errorEspacio.set(null);
    this.editandoEspacio.set(id);
  }
  protected guardarEspacio(): void {
    const id = this.editandoEspacio();
    if (!id || this.trabajando()) return;
    const e = errorDeEspacio(this.formEspacio);
    this.erroresEspacio.set(e);
    if (Object.keys(e).length) { this.errorEspacio.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = espacioParaApi(this.formEspacio);
    (id === 'nuevo' ? this.api.crearEspacio(cuerpo) : this.api.actualizarEspacio(id, cuerpo)).subscribe({
      next: (r) => { this.trabajando.set(false); this.editandoEspacio.set(null); this.aviso.set(r.mensajes?.[0] ?? 'Espacio guardado.'); this.cargarEspacios(); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorEspacio.set(x.general); if (x.campos) this.erroresEspacio.set(x.campos); },
    });
  }
}
