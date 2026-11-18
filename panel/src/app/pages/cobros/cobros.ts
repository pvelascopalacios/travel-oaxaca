import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import {
  FormActivar, FormCobro, accionesDePago, activarParaApi, aNumero, calcularCobro, conceptoTexto, cuponVigente, dinero, errorDeActivar, errorDeCobro, estadoPago,
  estadoPrecio, estadoSuscripcion, fechaLarga, formActivarVacio, formCobroVacio, hoyIso, metodoTexto, ordenarPagos, periodoTexto, suscripcionVigente,
  valorCuponTexto, vacioANull, vigenciaNueva,
} from '../../core/cobros';
import { Cupon, Pago, PlanPublico, ResultadoActivacion, Suscripcion } from '../../core/modelos';
import { ErrorApi, leerError, tieneAlgunRol } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { Pendientes } from '../../core/pendientes';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { VacioEstado } from '../../shared/vacio';
import { enlazarError } from '../../core/avisos';

/** Cobros: pagos por confirmar, activar o renovar un plan y registrar otros cobros. Para ventas y administración. */
@Component({
  selector: 'app-cobros',
  imports: [FormsModule, RouterLink, SelectorNegocio, VacioEstado],
  templateUrl: './cobros.html',
  styleUrl: './cobros.scss',
})
export class Cobros {
  /** /cobros?tab=pendientes|activar|otro&negocio=<id>&nombre=<texto> */
  readonly tab = input<string>();
  readonly negocio = input<string>();
  readonly nombre = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);

  protected readonly tabActual = computed(() => (['activar', 'otro'].includes(this.tab() ?? '') ? this.tab()! : 'pendientes'));
  protected readonly hoy = hoyIso();
  protected readonly dinero = dinero;
  protected readonly fecha = fechaLarga;
  protected readonly metodoTexto = metodoTexto;
  protected readonly conceptoTexto = conceptoTexto;
  protected readonly estPago = estadoPago;
  protected readonly estSus = estadoSuscripcion;
  protected readonly periodoTexto = periodoTexto;
  protected readonly valorCupon = valorCuponTexto;
  protected readonly acciones = accionesDePago;

  // ---- pendientes ----
  protected readonly pagos = signal<Pago[] | null>(null);
  protected readonly falloPagos = signal<ErrorApi | null>(null);
  protected readonly nombres = signal<Record<string, string>>({});
  protected readonly ordenados = computed(() => ordenarPagos(this.pagos() ?? []));
  protected readonly enAccion = signal<{ id: string; estado: string; texto: string } | null>(null);
  protected referenciaAccion = '';
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly avisoPagos = signal<string | null>(null);

  // ---- activar ----
  protected readonly elegido = signal<NegocioElegido | null>(null);
  protected readonly planes = signal<PlanPublico[]>([]);
  protected readonly cupones = signal<Cupon[] | null>(null);
  protected readonly suscripciones = signal<Suscripcion[] | null>(null);
  protected form: FormActivar = formActivarVacio();
  protected readonly formVersion = signal(0);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly trabajando = signal(false);
  protected readonly resultado = signal<ResultadoActivacion | null>(null);

  protected readonly planesCobrables = computed(() => this.planes().filter((p) => p.clave !== 'gratis'));
  protected readonly vigente = computed(() => suscripcionVigente(this.suscripciones() ?? []));
  protected readonly planElegido = computed(() => { this.formVersion(); return this.planes().find((p) => p.clave === this.form.planClave) ?? null; });
  protected readonly preciosPlan = computed(() => {
    this.formVersion();
    return (this.planElegido()?.precios ?? []).filter((p) => p.periodo === this.form.periodo && estadoPrecio(p) === 'vigente');
  });
  protected readonly precioGeneral = computed(() => this.preciosPlan().find((p) => !p.destinoId && !p.categoriaId) ?? null);
  protected readonly hayEspecificos = computed(() => this.preciosPlan().some((p) => p.destinoId || p.categoriaId));
  protected readonly cuponElegido = computed(() => {
    this.formVersion();
    const c = this.form.cupon.trim().toLowerCase();
    if (!c) return null;
    return (this.cupones() ?? []).find((x) => x.codigo.toLowerCase() === c) ?? null;
  });
  protected readonly cuponInvalido = computed(() => { const c = this.cuponElegido(); return !!c && (c.aplicaA !== 'suscripcion' || !cuponVigente(c)); });
  protected readonly cobro = computed(() => {
    this.formVersion();
    const c = this.cuponElegido();
    return calcularCobro(aNumero(this.form.monto), this.precioGeneral()?.monto ?? null, c && !this.cuponInvalido() ? c : null);
  });
  protected readonly vigencia = computed(() => {
    this.formVersion();
    const p = this.planElegido();
    if (!p) return null;
    return vigenciaNueva(this.vigente(), p.clave, this.form.periodo, this.cobro().periodos, this.hoy);
  });
  protected readonly cobraAlgo = computed(() => this.cobro().total === null || this.cobro().total! > 0);

  // ---- otro cobro ----
  protected readonly elegidoOtro = signal<NegocioElegido | null>(null);
  protected formOtro: FormCobro = formCobroVacio();
  protected readonly erroresOtro = signal<Record<string, string>>({});
  protected readonly errorApiOtro = signal<string | null>(null);
  protected readonly pagoRegistrado = signal<Pago | null>(null);

  constructor() {
    effect(() => {
      if (this.tabActual() === 'pendientes') this.cargarPagos();
    });
    effect(() => {
      const id = this.negocio();
      if (id && this.tabActual() === 'activar' && this.elegido()?.id !== id) this.elegirNegocio({ id, nombre: this.nombre() || 'Negocio elegido' });
    });
    this.api.planesPublicos().subscribe({ next: (p) => this.planes.set(p), error: () => undefined });
    // Solo administración puede leer los cupones; ventas los escribe y la API los valida al activar.
    if (tieneAlgunRol(inject(Sesion).usuario()?.roles, ['admin'])) this.api.cupones().subscribe({ next: (c) => this.cupones.set(c), error: () => this.cupones.set(null) });
  }

  protected cambio(): void { this.formVersion.update((n) => n + 1); }

  // ---------- pendientes ----------
  protected cargarPagos(): void {
    this.falloPagos.set(null);
    this.api.pagosPendientes().subscribe({
      next: (l) => {
        this.pagos.set(l);
        this.pendientes.pagos.set(l.length);
        for (const id of new Set(l.map((p) => p.negocioId))) {
          if (this.nombres()[id]) continue;
          this.api.negocio(id).subscribe({ next: (f) => this.nombres.update((m) => ({ ...m, [id]: f.nombreComercial })), error: () => undefined });
        }
      },
      error: (e) => this.falloPagos.set(leerError(e, 'No pudimos cargar los pagos pendientes.')),
    });
  }

  protected abrirAccion(p: Pago, a: { estado: string; texto: string }): void {
    this.enAccion.set({ id: p.id, estado: a.estado, texto: a.texto });
    this.referenciaAccion = p.referenciaExterna ?? '';
    this.errorAccion.set(null);
    this.avisoPagos.set(null);
  }

  protected confirmarAccion(): void {
    const a = this.enAccion();
    if (!a || this.trabajando()) return;
    if (this.referenciaAccion.length > 100) { this.errorAccion.set('Máximo 100 caracteres.'); return; }
    this.trabajando.set(true);
    this.api.cambiarEstadoPago(a.id, a.estado, vacioANull(this.referenciaAccion)).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.enAccion.set(null);
        this.avisoPagos.set(r.mensajes?.[0] ?? 'Pago actualizado.');
        this.cargarPagos();
      },
      error: (e) => { this.trabajando.set(false); this.errorAccion.set(leerError(e).general); },
    });
  }

  // ---------- activar ----------
  protected elegirNegocio(n: NegocioElegido | null): void {
    this.elegido.set(n);
    this.suscripciones.set(null);
    this.resultado.set(null);
    if (!n) {
      void this.router.navigate([], { queryParams: { negocio: null, nombre: null }, queryParamsHandling: 'merge' });
      return;
    }
    this.api.suscripciones(n.id).subscribe({ next: (l) => this.suscripciones.set(l), error: () => this.suscripciones.set([]) });
  }

  protected activar(): void {
    if (this.trabajando()) return;
    this.errorApi.set(null);
    const n = this.elegido();
    const cobro = this.cobro();
    const errores = errorDeActivar(this.form, cobro);
    if (!n) errores['negocioId'] = 'Elige el negocio.';
    this.errores.set(errores);
    if (Object.keys(errores).length) return;
    this.trabajando.set(true);
    this.api.activarPlan(n!.id, activarParaApi(this.form, cobro)).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.resultado.set(r.datos);
        this.pendientes.refrescarPagos();
        this.api.suscripciones(n!.id).subscribe({ next: (l) => this.suscripciones.set(l), error: () => undefined });
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApi.set(er.general);
        if (er.campos) this.errores.set(er.campos);
      },
    });
  }

  protected otraActivacion(): void {
    this.resultado.set(null);
    this.form = formActivarVacio();
    this.errores.set({});
    this.cambio();
  }

  // ---------- otro cobro ----------
  protected registrarOtro(): void {
    if (this.trabajando()) return;
    this.errorApiOtro.set(null);
    const n = this.elegidoOtro();
    const errores = errorDeCobro(this.formOtro, n?.id ?? null);
    this.erroresOtro.set(errores);
    if (Object.keys(errores).length) return;
    this.trabajando.set(true);
    this.api.registrarPago({
      negocioId: n!.id, concepto: 'otro', patrocinioId: null, monto: aNumero(this.formOtro.monto)!, metodo: this.formOtro.metodo,
      referencia: vacioANull(this.formOtro.referencia), pagado: this.formOtro.pagado,
    }).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.pagoRegistrado.set(r.datos);
        this.pendientes.refrescarPagos();
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApiOtro.set(er.general);
        if (er.campos) this.erroresOtro.set(er.campos);
      },
    });
  }

  protected otroNuevo(): void {
    this.pagoRegistrado.set(null);
    this.formOtro = formCobroVacio();
    this.elegidoOtro.set(null);
  }
}
