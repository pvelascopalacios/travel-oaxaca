import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Importacion } from '../../core/modelos';
import { ErrorApi, fechaHora, leerError } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { errorDeArchivoCsv, estaAbierta, estadoImportacion, guardarBlob, hayErroresSinMostrar, planDeAplicar, tipoImportacionTexto, tiposImportables } from '../../core/ventas';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Importar CSV: subir y revisar completo, y solo entonces aplicar. Cada rol ve los tipos que puede importar. */
@Component({
  selector: 'app-importaciones',
  imports: [FormsModule],
  templateUrl: './importaciones.html',
  styleUrl: './importaciones.scss',
})
export class Importaciones implements OnInit {
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);

  protected readonly tipos = computed(() => tiposImportables(this.sesion.usuario()?.roles));
  protected tipo = '';
  protected readonly tipoInfo = computed(() => this.tipos().find((t) => t.clave === this.tipo) ?? this.tipos()[0] ?? null);

  protected readonly actual = signal<Importacion | null>(null);
  protected readonly historial = signal<Importacion[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly tamano = 10;
  protected readonly cargandoHist = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => ({}));
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly arrastrando = signal(false);

  protected readonly estadoInfo = estadoImportacion;
  protected readonly tipoTexto = tipoImportacionTexto;
  protected readonly fechaHora = fechaHora;
  protected readonly plan = computed(() => (this.actual() ? planDeAplicar(this.actual()!) : null));
  protected readonly abierta = computed(() => (this.actual() ? estaAbierta(this.actual()!) : false));
  protected readonly sinMostrar = computed(() => (this.actual() ? hayErroresSinMostrar(this.actual()!, this.actual()!.errores) : false));
  protected readonly paso = computed(() => (!this.actual() ? 1 : this.abierta() ? 2 : 3));
  protected readonly hayAnterior = computed(() => this.pagina() > 0);
  protected readonly haySiguiente = computed(() => (this.pagina() + 1) * this.tamano < this.total());

  ngOnInit(): void {
    this.tipo = this.tipos()[0]?.clave ?? '';
    this.cargarHistorial();
  }

  protected cargarHistorial(): void {
    this.cargandoHist.set(true);
    this.api.importaciones(this.pagina(), this.tamano).subscribe({
      next: (p) => { this.historial.set(p.elementos); this.total.set(p.total); this.cargandoHist.set(false); },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar el historial.')); this.cargandoHist.set(false); },
    });
  }

  protected irPagina(d: number): void {
    this.pagina.update((p) => Math.max(0, p + d));
    this.cargarHistorial();
  }

  protected plantilla(): void {
    if (!this.tipo) return;
    this.errorApi.set(null);
    this.api.plantillaImportacion(this.tipo).subscribe({
      next: (b) => guardarBlob(b, `plantilla-${this.tipo}.csv`),
      error: (e) => this.errorApi.set(leerError(e, 'No pudimos descargar la plantilla.').general),
    });
  }

  protected alElegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) this.subir(f);
  }

  protected alSoltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.subir(f);
  }

  protected subir(f: File): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    this.confirmando.set(false);
    const e = errorDeArchivoCsv(f);
    this.errorArchivo.set(e);
    if (e || !this.tipo) return;
    this.trabajando.set('subir');
    this.api.subirImportacion(this.tipo, f).subscribe({
      next: (r) => { this.trabajando.set(null); if (r.datos) this.actual.set(r.datos); this.pagina.set(0); this.cargarHistorial(); },
      error: (er) => { this.trabajando.set(null); const x = leerError(er); this.errorApi.set(x.campos['archivo'] ?? x.general); },
    });
  }

  protected ver(i: Importacion): void {
    this.aviso.set(null);
    this.errorApi.set(null);
    this.confirmando.set(false);
    this.trabajando.set('ver');
    this.api.importacion(i.id).subscribe({
      next: (d) => { this.trabajando.set(null); this.actual.set(d); },
      error: (e) => { this.trabajando.set(null); this.errorApi.set(leerError(e).general); },
    });
  }

  protected descargarErrores(): void {
    const i = this.actual();
    if (!i) return;
    this.api.erroresImportacion(i.id).subscribe({
      next: (b) => guardarBlob(b, `errores-${i.archivo.replace(/\.csv$/i, '')}.csv`),
      error: (e) => this.errorApi.set(leerError(e, 'No pudimos descargar los errores.').general),
    });
  }

  protected aplicar(): void {
    const i = this.actual();
    const p = this.plan();
    if (!i || !p?.puede || this.trabajando()) return;
    if (p.pideConfirmar && !this.confirmando()) { this.confirmando.set(true); return; }
    this.trabajando.set('aplicar');
    this.errorApi.set(null);
    this.api.aplicarImportacion(i.id, p.pideConfirmar).subscribe({
      next: (r) => { this.trabajando.set(null); this.confirmando.set(false); if (r.datos) this.actual.set(r.datos); this.aviso.set(r.mensajes?.[0] ?? 'Importación aplicada.'); this.cargarHistorial(); },
      error: (er) => { this.trabajando.set(null); this.confirmando.set(false); this.errorApi.set(leerError(er).general); this.ver(i); },
    });
  }

  protected cancelar(): void {
    const i = this.actual();
    if (!i || this.trabajando()) return;
    this.trabajando.set('cancelar');
    this.errorApi.set(null);
    this.api.cancelarImportacion(i.id).subscribe({
      next: (r) => { this.trabajando.set(null); if (r.datos) this.actual.set(r.datos); this.aviso.set(r.mensajes?.[0] ?? 'Importación cancelada.'); this.cargarHistorial(); },
      error: (er) => { this.trabajando.set(null); this.errorApi.set(leerError(er).general); this.ver(i); },
    });
  }

  protected otra(): void {
    this.actual.set(null);
    this.aviso.set(null);
    this.errorApi.set(null);
    this.confirmando.set(false);
  }
}
