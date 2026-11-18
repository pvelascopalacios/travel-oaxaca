import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Afiliado, ClicDia } from '../../core/modelos';
import { ErrorApi, leerError, tieneAlgunRol } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { ESTADOS_AFILIADO, FormAfiliado, afiliadoParaApi, completarDias, errorDeAfiliado, estadoAfiliado, formAfiliadoVacio, haceDias, hoyISO, resumenClics } from '../../core/ventas';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Enlaces de afiliados con clics de 30 días y clics por día. Admin crea y edita; edición y ventas solo lo ven. */
@Component({
  selector: 'app-afiliados',
  imports: [FormsModule, SelectorNegocio],
  templateUrl: './afiliados.html',
  styleUrl: './afiliados.scss',
})
export class Afiliados implements OnInit {
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);
  protected readonly esAdmin = computed(() => tieneAlgunRol(this.sesion.usuario()?.roles, ['admin']));

  protected readonly lista = signal<Afiliado[] | null>(null);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly estados = ESTADOS_AFILIADO;
  protected readonly estadoInfo = estadoAfiliado;

  /** 'nuevo' o el id que se edita. */
  protected readonly editando = signal<string | null>(null);
  protected form: FormAfiliado = formAfiliadoVacio();
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly trabajando = signal(false);
  protected readonly negocioElegido = computed<NegocioElegido | null>(() => { this.version(); return this.form.negocioId ? { id: this.form.negocioId, nombre: this.form.negocioNombre || 'Negocio elegido' } : null; });
  protected readonly version = signal(0);

  // clics
  protected readonly verClics = signal<Afiliado | null>(null);
  protected desde = haceDias(29);
  protected hasta = hoyISO();
  protected readonly dias = signal<ClicDia[]>([]);
  protected readonly cargandoClics = signal(false);
  protected readonly errorClics = signal<string | null>(null);
  protected readonly resumen = computed(() => resumenClics(this.dias()));
  protected readonly altura = (c: number): number => (this.resumen().maximo > 0 ? Math.max(3, Math.round((c / this.resumen().maximo) * 100)) : 3);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fallo.set(null);
    this.api.afiliados().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar los enlaces.')) });
  }

  protected nuevo(): void {
    this.aviso.set(null);
    this.errores.set({});
    this.errorApi.set(null);
    this.form = formAfiliadoVacio();
    this.editando.set('nuevo');
    this.version.update((n) => n + 1);
  }

  protected editar(a: Afiliado): void {
    this.aviso.set(null);
    this.errores.set({});
    this.errorApi.set(null);
    this.form = { codigo: a.codigo, destinoUrl: a.destinoUrl, socio: a.socio, comisionPct: a.comisionPct === null ? '' : String(a.comisionPct), estado: a.estado, negocioId: a.negocioId ?? '', negocioNombre: '' };
    this.editando.set(a.id);
    this.version.update((n) => n + 1);
  }

  protected cancelar(): void {
    this.editando.set(null);
    this.errores.set({});
    this.errorApi.set(null);
  }

  protected elegirNegocio(n: NegocioElegido | null): void {
    this.form.negocioId = n?.id ?? '';
    this.form.negocioNombre = n?.nombre ?? '';
    this.version.update((x) => x + 1);
  }

  protected guardar(): void {
    if (this.trabajando() || !this.editando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const e = errorDeAfiliado(this.form);
    this.errores.set(e);
    if (Object.keys(e).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = afiliadoParaApi(this.form);
    const id = this.editando()!;
    (id === 'nuevo' ? this.api.crearAfiliado(cuerpo) : this.api.actualizarAfiliado(id, cuerpo)).subscribe({
      next: (r) => { this.trabajando.set(false); this.editando.set(null); this.aviso.set(r.mensajes?.[0] ?? 'Enlace guardado.'); this.cargar(); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.general); if (x.campos) this.errores.set(x.campos); },
    });
  }

  protected abrirClics(a: Afiliado): void {
    this.verClics.set(this.verClics()?.id === a.id ? null : a);
    if (this.verClics()) this.cargarClics();
  }

  protected cargarClics(): void {
    const a = this.verClics();
    if (!a) return;
    if (!this.desde || !this.hasta || this.desde > this.hasta) { this.errorClics.set('La fecha inicial debe ser anterior o igual a la final.'); return; }
    this.errorClics.set(null);
    this.cargandoClics.set(true);
    this.api.clicsAfiliado(a.id, this.desde, this.hasta).subscribe({
      next: (l) => { this.dias.set(completarDias(l, this.desde, this.hasta)); this.cargandoClics.set(false); },
      error: (e) => { this.errorClics.set(leerError(e, 'No pudimos cargar los clics.').general); this.cargandoClics.set(false); },
    });
  }
}
