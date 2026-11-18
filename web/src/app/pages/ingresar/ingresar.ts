import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, destinoSeguro, leerError } from '../../core/cuenta';
import { I18n } from '../../core/i18n';
import { Medicion } from '../../core/medicion';
import { RespuestaSesion } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';

export type Vista = 'ingreso' | 'registro' | 'olvide' | 'restablecer' | 'verificar';

/** Ingresar, crear cuenta, recuperar la contraseña, confirmar el correo y —con sesión— la página de la cuenta. */
@Component({
  selector: 'app-ingresar',
  imports: [FormsModule, RouterLink],
  templateUrl: './ingresar.html',
  styleUrl: './ingresar.scss',
})
export class Ingresar implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly medicion = inject(Medicion);

  protected readonly vista = signal<Vista>('ingreso');
  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly aviso = signal<string | null>(null);
  protected readonly volver = signal<string | null>(null);

  protected nombre = '';
  protected correo = '';
  protected clave = '';
  protected acepta = false;
  private token = '';

  /** Con sesión y sin nada que hacer en la dirección, se muestra la cuenta. */
  protected readonly enCuenta = computed(() => this.sesion.autenticado() && (this.vista() === 'ingreso' || this.vista() === 'registro'));

  constructor() {
    effect(() => {
      // Si la sesión aparece mientras se estaba en esta página (restauración o ingreso), se respeta «volver».
      const dentro = this.sesion.autenticado();
      const v = untracked(() => this.volver());
      if (dentro && v && untracked(() => this.vista()) !== 'restablecer') void this.router.navigateByUrl(v);
    });
  }

  ngOnInit(): void {
    const q = this.ruta.snapshot.queryParamMap;
    this.volver.set(destinoSeguro(q.get('volver')));
    this.token = q.get('token') ?? '';
    const modo = this.ruta.snapshot.data['modo'] as Vista | undefined;
    if (modo === 'restablecer' || modo === 'verificar') this.vista.set(modo);
    else if (q.get('modo') === 'registro') this.vista.set('registro');
    this.seo.pagina(this.i18n.t(this.tituloClave()), this.i18n.t('cuentaSeo'), 'ingresar', { noIndexar: true });
    if (modo === 'verificar') this.confirmarCorreo();
  }

  protected tituloClave(): 'iniciarSesion' | 'crearCuenta' | 'olvideTitulo' | 'restablecerTitulo' | 'verificarTitulo' {
    switch (this.vista()) {
      case 'registro': return 'crearCuenta';
      case 'olvide': return 'olvideTitulo';
      case 'restablecer': return 'restablecerTitulo';
      case 'verificar': return 'verificarTitulo';
      default: return 'iniciarSesion';
    }
  }

  protected cambiar(v: Vista): void {
    this.vista.set(v);
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
  }

  protected campo(nombre: string): string | null {
    return this.error().campos[nombre] ?? null;
  }

  protected async enviar(): Promise<void> {
    if (this.enviando()) return;
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    this.enviando.set(true);
    const falla = (e: unknown) => {
      this.enviando.set(false);
      this.error.set(leerError(e, this.i18n.t('errorCarga')));
    };
    const dispositivoId = await this.medicion.dispositivoId();
    const vista = this.vista();
    if (vista === 'ingreso') {
      this.api.ingreso({ correo: this.correo.trim(), clave: this.clave, dispositivoId }).subscribe({ next: (r) => this.alEntrar(r.datos), error: falla });
    } else if (vista === 'registro') {
      this.api
        .registro({ correo: this.correo.trim(), clave: this.clave, nombre: this.nombre.trim(), aceptaTerminos: this.acepta, dispositivoId })
        .subscribe({ next: (r) => { this.alEntrar(r.datos); this.aviso.set(r.mensajes?.[0] ?? null); }, error: falla });
    } else if (vista === 'olvide') {
      this.api.olvideClave(this.correo.trim()).subscribe({
        next: (r) => { this.enviando.set(false); this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('olvideListo')); },
        error: falla,
      });
    } else if (vista === 'restablecer') {
      this.api.restablecerClave(this.token, this.clave).subscribe({
        next: () => { this.enviando.set(false); this.clave = ''; this.cambiar('ingreso'); this.aviso.set(this.i18n.t('claveCambiada')); },
        error: falla,
      });
    }
  }

  private alEntrar(r: RespuestaSesion): void {
    this.enviando.set(false);
    this.clave = '';
    this.sesion.iniciar(r);
  }

  private confirmarCorreo(): void {
    this.enviando.set(true);
    this.api.verificarCorreo(this.token).subscribe({
      next: (r) => { this.enviando.set(false); this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('correoConfirmado')); },
      error: (e) => { this.enviando.set(false); this.error.set(leerError(e, this.i18n.t('errorCarga'))); },
    });
  }

  protected reenviar(): void {
    const u = this.sesion.usuario();
    if (!u) return;
    this.api.reenviarVerificacion(u.correo).subscribe({
      next: (r) => this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('olvideListo')),
      error: (e) => this.error.set(leerError(e, this.i18n.t('errorCarga'))),
    });
  }

  protected salir(): void {
    const t = this.sesion.tokenRenovacion();
    if (t) this.api.salir(t).subscribe({ error: () => undefined });
    this.sesion.cerrarLocal();
    this.aviso.set(null);
    this.cambiar('ingreso');
  }
}
