import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Api } from '../../core/api';
import { ESTADOS_USUARIO, ROLES_GLOBALES, esRolGlobal, estadoUsuario, iniciales, motivoNoCambiarEstado, motivoNoQuitarRol, rolesQueFaltan } from '../../core/comunidad';
import { UsuarioAdmin } from '../../core/modelos';
import { ErrorApi, fechaCorta, fechaHora, leerError, normalizarRol } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { VacioEstado } from '../../shared/vacio';
import { enlazarAviso } from '../../core/avisos';

/** Usuarios con filtros, roles de plataforma (admin, editor, ventas) y activar o suspender cuentas. Solo administración. */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, VacioEstado],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios {
  /** /usuarios?texto=rosa&estado=activo&rol=editor&pagina=2 */
  readonly texto = input<string>();
  readonly estado = input<string>();
  readonly rol = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);
  protected readonly yoId = computed(() => this.sesion.usuario()?.id ?? null);

  protected readonly estados = ESTADOS_USUARIO;
  protected readonly roles = ROLES_GLOBALES;
  protected readonly filas = signal<UsuarioAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly textoBusqueda = signal('');
  private readonly escribiendo = new Subject<string>();

  /** Cuenta abierta para administrar. */
  protected readonly abierto = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly trabajando = signal(false);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly errorAccion = signal<string | null>(null);
  protected rolNuevo = '';

  protected readonly estadoInfo = estadoUsuario;
  protected readonly inic = iniciales;
  protected readonly faltan = rolesQueFaltan;
  protected readonly fecha = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly norm = normalizarRol;
  protected readonly esGlobal = esRolGlobal;
  protected readonly noQuitar = (u: UsuarioAdmin, r: string) => motivoNoQuitarRol(u, r, this.yoId());
  protected readonly noEstado = (u: UsuarioAdmin) => motivoNoCambiarEstado(u, this.yoId());

  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  constructor() {
    inject(ActivatedRoute);
    effect(() => this.textoBusqueda.set(this.texto() ?? ''));
    effect(() => {
      this.texto();
      this.estado();
      this.rol();
      this.pagina();
      this.cargar();
    });
    this.escribiendo.pipe(debounceTime(400)).subscribe((t) => this.navegar({ texto: t.trim() || null }));
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { texto: this.texto() || null, estado: this.estado() || null, rol: this.rol() || null, pagina: null, ...extra };
  }
  protected readonly hayFiltros = computed(() => !!(this.texto() || this.estado() || this.rol()));
  protected quitarFiltros(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected navegar(extra: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: this.consulta(extra) });
  }
  protected buscar(t: string): void {
    this.textoBusqueda.set(t);
    this.escribiendo.next(t);
  }
  protected irPagina(delta: number): void {
    this.navegar({ pagina: this.nPagina() + 1 + delta > 1 ? String(this.nPagina() + 1 + delta) : null });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.usuarios({ texto: this.texto(), estado: this.estado(), rol: this.rol(), pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar los usuarios. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  protected administrar(u: UsuarioAdmin): void {
    this.abierto.set(this.abierto() === u.id ? null : u.id);
    this.confirmando.set(false);
    this.aviso.set(null);
    this.errorAccion.set(null);
    this.rolNuevo = '';
  }

  private ejecutar(llamada: ReturnType<Api['asignarRol']>): void {
    this.trabajando.set(true);
    this.aviso.set(null);
    this.errorAccion.set(null);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.confirmando.set(false);
        this.rolNuevo = '';
        this.aviso.set(r.mensajes?.[0] ?? 'Listo.');
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(false);
        this.confirmando.set(false);
        const er = leerError(e);
        this.errorAccion.set(er.campos['rol'] ?? er.campos['estado'] ?? er.general ?? 'No se pudo completar.');
      },
    });
  }

  protected agregarRol(u: UsuarioAdmin): void {
    if (!this.rolNuevo) { this.errorAccion.set('Elige el rol que quieres agregar.'); return; }
    this.ejecutar(this.api.asignarRol(u.id, this.rolNuevo));
  }
  protected quitarRol(u: UsuarioAdmin, rol: string): void {
    this.ejecutar(this.api.quitarRol(u.id, normalizarRol(rol)));
  }
  protected cambiarEstado(u: UsuarioAdmin, estado: 'activo' | 'suspendido'): void {
    this.ejecutar(this.api.cambiarEstadoUsuario(u.id, estado));
  }
}
