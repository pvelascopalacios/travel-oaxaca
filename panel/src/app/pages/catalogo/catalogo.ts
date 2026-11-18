import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import {
  FormCupon, FormPlan, FormPrecio, TIPOS_CUPON, alcancePrecio, aplicaATexto, categoriasConRuta, cuponEdicionParaApi, cuponParaApi, cuponVigente, dinero, errorDeCupon, errorDePlan, errorDePrecio,
  estadoPrecio, fechaLarga, formCuponVacio, formDeCupon, formDePlan, formPrecioVacio, hoyIso, ordenarPrecios, periodoTexto, planParaApi, precioParaApi, tipoCuponTexto, valorCuponTexto,
} from '../../core/cobros';
import { Categoria, Cupon, Destino, Plan, Precio } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/panel';
import { enlazarAviso } from '../../core/avisos';

/** Planes, precios y cupones. Solo administración. */
@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  /** /catalogo?tab=planes|precios|cupones */
  readonly tab = input<string>();
  private readonly api = inject(Api);

  protected readonly tabActual = computed(() => (['precios', 'cupones'].includes(this.tab() ?? '') ? this.tab()! : 'planes'));
  protected readonly planes = signal<Plan[] | null>(null);
  protected readonly precios = signal<Precio[] | null>(null);
  protected readonly cupones = signal<Cupon[] | null>(null);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal(false);
  protected readonly hoy = hoyIso();

  protected readonly dinero = dinero;
  protected readonly fecha = fechaLarga;
  protected readonly periodo = periodoTexto;
  protected readonly tipos = TIPOS_CUPON;
  protected readonly tipoTexto = tipoCuponTexto;
  protected readonly aplicaA = aplicaATexto;
  protected readonly valorTexto = valorCuponTexto;
  protected readonly vigenteCupon = (c: Cupon): boolean => cuponVigente(c);
  protected readonly categorias = computed(() => categoriasConRuta(this.arbol()));
  protected readonly preciosOrdenados = computed(() => ordenarPrecios(this.precios() ?? [], this.planes() ?? []));
  protected readonly planesConPrecio = computed(() => (this.planes() ?? []).filter((p) => p.clave !== 'gratis'));
  protected readonly estadoP = (p: Precio): string => estadoPrecio(p);
  protected readonly alcance = (p: Precio): string => alcancePrecio(p, this.destinos(), this.arbol());
  protected readonly planNombre = (id: string): string => this.planes()?.find((p) => p.id === id)?.nombre ?? '—';

  // planes
  protected editandoPlan = signal<string | null>(null);
  protected formPlan: FormPlan | null = null;
  protected erroresPlan = signal<Record<string, string>>({});
  protected errorApiPlan = signal<string | null>(null);

  // precios
  protected nuevoPrecio = signal(false);
  protected formPrecio: FormPrecio = formPrecioVacio();
  protected erroresPrecio = signal<Record<string, string>>({});
  protected errorApiPrecio = signal<string | null>(null);
  protected cerrandoPrecio = signal<string | null>(null);
  protected hastaCierre = '';

  // cupones
  protected nuevoCupon = signal(false);
  protected editandoCupon = signal<Cupon | null>(null);
  protected formCupon: FormCupon = formCuponVacio();
  protected erroresCupon = signal<Record<string, string>>({});
  protected errorApiCupon = signal<string | null>(null);

  constructor() {
    this.cargar();
    this.api.destinos().subscribe({ next: (d) => this.destinos.set(d), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  protected cargar(): void {
    this.fallo.set(null);
    const falla = (e: unknown) => this.fallo.set(leerError(e, 'No pudimos cargar el catálogo. Inténtalo de nuevo.'));
    this.api.planes().subscribe({ next: (l) => this.planes.set(l), error: falla });
    this.api.precios().subscribe({ next: (l) => this.precios.set(l), error: falla });
    this.api.cupones().subscribe({ next: (l) => this.cupones.set(l), error: falla });
  }

  // ---------- planes ----------
  protected editarPlan(p: Plan): void { this.editandoPlan.set(p.id); this.formPlan = formDePlan(p); this.erroresPlan.set({}); this.errorApiPlan.set(null); this.aviso.set(null); }

  protected guardarPlan(p: Plan): void {
    if (this.trabajando() || !this.formPlan) return;
    const e = errorDePlan(this.formPlan);
    this.erroresPlan.set(e);
    if (Object.keys(e).length) return;
    this.trabajando.set(true);
    this.api.actualizarPlan(p.id, planParaApi(this.formPlan, p)).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.editandoPlan.set(null);
        this.aviso.set(r.mensajes?.[0] ?? 'Plan actualizado.');
        this.planes.update((l) => (l ?? []).map((x) => (x.id === p.id ? r.datos : x)));
      },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApiPlan.set(x.general); if (x.campos) this.erroresPlan.set(x.campos); },
    });
  }

  // ---------- precios ----------
  protected abrirPrecio(): void { this.nuevoPrecio.set(true); this.formPrecio = formPrecioVacio(); this.erroresPrecio.set({}); this.errorApiPrecio.set(null); this.aviso.set(null); }

  protected guardarPrecio(): void {
    if (this.trabajando()) return;
    const e = errorDePrecio(this.formPrecio);
    this.erroresPrecio.set(e);
    if (Object.keys(e).length) return;
    this.trabajando.set(true);
    this.api.crearPrecio(precioParaApi(this.formPrecio)).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.nuevoPrecio.set(false);
        this.aviso.set(r.mensajes?.[0] ?? 'Precio creado.');
        this.api.precios().subscribe({ next: (l) => this.precios.set(l), error: () => undefined });
      },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApiPrecio.set(x.general); if (x.campos) this.erroresPrecio.set(x.campos); },
    });
  }

  protected abrirCierre(p: Precio): void { this.cerrandoPrecio.set(p.id); this.hastaCierre = ''; this.errorApiPrecio.set(null); this.aviso.set(null); }

  protected cerrarPrecio(p: Precio): void {
    if (this.trabajando()) return;
    if (this.hastaCierre && this.hastaCierre < p.vigenteDesde) { this.errorApiPrecio.set('La fecha no puede ser anterior al inicio del precio.'); return; }
    this.trabajando.set(true);
    this.api.cerrarPrecio(p.id, this.hastaCierre || null).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.cerrandoPrecio.set(null);
        this.aviso.set(r.mensajes?.[0] ?? 'Precio cerrado.');
        this.precios.update((l) => (l ?? []).map((x) => (x.id === p.id ? r.datos : x)));
      },
      error: (er) => { this.trabajando.set(false); this.errorApiPrecio.set(leerError(er).general); },
    });
  }

  // ---------- cupones ----------
  protected abrirCupon(): void { this.nuevoCupon.set(true); this.editandoCupon.set(null); this.formCupon = formCuponVacio(); this.erroresCupon.set({}); this.errorApiCupon.set(null); this.aviso.set(null); }
  protected editarCupon(c: Cupon): void { this.editandoCupon.set(c); this.nuevoCupon.set(false); this.formCupon = formDeCupon(c); this.erroresCupon.set({}); this.errorApiCupon.set(null); this.aviso.set(null); }
  protected cerrarCupon(): void { this.nuevoCupon.set(false); this.editandoCupon.set(null); }

  protected guardarCupon(): void {
    if (this.trabajando()) return;
    const ed = this.editandoCupon();
    const e = errorDeCupon(this.formCupon, ed?.usos ?? 0);
    if (ed) { for (const k of ['codigo', 'valor']) delete e[k]; }
    this.erroresCupon.set(e);
    if (Object.keys(e).length) return;
    this.trabajando.set(true);
    const llamada = ed ? this.api.actualizarCupon(ed.id, cuponEdicionParaApi(this.formCupon)) : this.api.crearCupon(cuponParaApi(this.formCupon));
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.cerrarCupon();
        this.aviso.set(r.mensajes?.[0] ?? (ed ? 'Cupón actualizado.' : 'Cupón creado.'));
        this.api.cupones().subscribe({ next: (l) => this.cupones.set(l), error: () => undefined });
      },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApiCupon.set(x.general); if (x.campos) this.erroresCupon.set(x.campos); },
    });
  }
}
