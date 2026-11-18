import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, leerError } from '../../core/cuenta';
import { I18n } from '../../core/i18n';
import { Clave } from '../../core/textos';
import { Consentimiento, Perfil as PerfilModelo, SesionActiva, SolicitudPrivacidad, TipoConsentimiento, TipoSolicitud } from '../../core/modelos';
import {
  ErroresClave, ErroresPerfil, PREFERENCIAS, TIPOS_SOLICITUD, claseEstado, consentimientoVigente, fechaConsentimiento, hayErrores, iniciales,
  normalizarTelefono, ordenarSesiones, ordenarSolicitudes, otrasSesiones, plataformaClave, soloFecha, solicitudAbierta, validarClave, validarPerfil,
} from '../../core/perfil';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';

type Seccion = 'datos' | 'seguridad' | 'actividad' | 'privacidad';
const SIN_ERROR: ErrorApi = { general: null, campos: {} };

/** El perfil de la persona: sus datos, su seguridad, su actividad y sus derechos de privacidad. Pide sesión. */
@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly router = inject(Router);
  private saliendo = false;

  protected readonly secciones: { clave: Seccion; titulo: Clave }[] = [
    { clave: 'datos', titulo: 'perfilTabDatos' },
    { clave: 'seguridad', titulo: 'perfilTabSeguridad' },
    { clave: 'actividad', titulo: 'perfilTabActividad' },
    { clave: 'privacidad', titulo: 'perfilTabPrivacidad' },
  ];
  protected readonly seccion = signal<Seccion>('datos');

  // ---- perfil / datos ----
  protected readonly perfil = signal<PerfilModelo | null>(null);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);
  protected nombre = '';
  protected telefono = '';
  protected idioma = 'es';
  protected readonly erroresDatos = signal<ErroresPerfil>({});
  protected readonly errorDatos = signal<ErrorApi>(SIN_ERROR);
  protected readonly guardandoDatos = signal(false);
  protected readonly avisoDatos = signal<string | null>(null);
  protected readonly avisoCorreo = signal<string | null>(null);

  // ---- seguridad ----
  protected readonly sesiones = signal<SesionActiva[] | null>(null);
  protected readonly falloSesiones = signal(false);
  protected readonly sesionesOrdenadas = computed(() => ordenarSesiones(this.sesiones() ?? []));
  protected readonly hayOtras = computed(() => otrasSesiones(this.sesiones() ?? []).length > 0);
  protected readonly cerrandoSesion = signal<string | null>(null);
  protected readonly avisoSesiones = signal<string | null>(null);
  protected readonly errorSesiones = signal<string | null>(null);
  protected claveActual = '';
  protected claveNueva = '';
  protected claveRepetir = '';
  protected readonly erroresClave = signal<ErroresClave>({});
  protected readonly errorClave = signal<ErrorApi>(SIN_ERROR);
  protected readonly cambiandoClave = signal(false);
  protected readonly avisoClave = signal<string | null>(null);

  // ---- privacidad ----
  protected readonly preferencias = PREFERENCIAS;
  protected readonly tiposSolicitud = TIPOS_SOLICITUD;
  protected readonly consentimientos = signal<Consentimiento[] | null>(null);
  protected readonly solicitudes = signal<SolicitudPrivacidad[] | null>(null);
  protected readonly falloPrivacidad = signal(false);
  protected readonly solicitudesOrdenadas = computed(() => ordenarSolicitudes(this.solicitudes() ?? []));
  protected readonly guardandoPref = signal<TipoConsentimiento | null>(null);
  protected readonly avisoPref = signal<string | null>(null);
  protected readonly errorPref = signal<string | null>(null);
  protected readonly tipoSolicitud = signal<TipoSolicitud | null>(null);
  protected detalle = '';
  protected readonly enviandoSolicitud = signal(false);
  protected readonly avisoSolicitud = signal<string | null>(null);
  protected readonly errorSolicitud = signal<string | null>(null);
  protected readonly yaAbierta = computed(() => {
    const t = this.tipoSolicitud();
    return t !== null && solicitudAbierta(this.solicitudes() ?? [], t);
  });

  protected readonly iniciales = computed(() => iniciales(this.perfil()?.nombre ?? this.sesion.usuario()?.nombre ?? ''));

  constructor() {
    effect(() => {
      if (!this.sesion.listo() || this.saliendo) return;
      if (this.sesion.autenticado()) untracked(() => { if (!this.perfil()) this.cargar(); });
      else untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: `/${this.i18n.lang()}/perfil` } }));
    });
  }

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('perfilTitulo'), this.i18n.t('perfilSeo'), 'perfil', { noIndexar: true });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.api.perfil().subscribe({
      next: (p) => { this.poner(p); this.cargando.set(false); },
      error: () => { this.fallo.set(true); this.cargando.set(false); },
    });
  }

  private poner(p: PerfilModelo): void {
    this.perfil.set(p);
    this.nombre = p.nombre;
    this.telefono = p.telefonoE164 ?? '';
    this.idioma = p.idiomaCodigo === 'en' ? 'en' : 'es';
  }

  protected abrir(s: Seccion): void {
    this.seccion.set(s);
    if (s === 'seguridad' && this.sesiones() === null) this.cargarSesiones();
    if (s === 'privacidad' && this.consentimientos() === null) this.cargarPrivacidad();
  }

  // ---------------- datos ----------------

  protected guardarDatos(): void {
    if (this.guardandoDatos()) return;
    this.avisoDatos.set(null);
    this.errorDatos.set(SIN_ERROR);
    const e = validarPerfil(this.nombre, this.telefono);
    this.erroresDatos.set(e);
    if (hayErrores(e)) return;
    this.guardandoDatos.set(true);
    this.api.guardarPerfil({ nombre: this.nombre.trim(), telefonoE164: normalizarTelefono(this.telefono), idiomaCodigo: this.idioma }).subscribe({
      next: (r) => {
        this.guardandoDatos.set(false);
        this.poner(r.datos);
        this.sesion.actualizarDatos({ nombre: r.datos.nombre, idiomaCodigo: r.datos.idiomaCodigo });
        this.avisoDatos.set(r.mensajes?.[0] ?? this.i18n.t('perfilGuardado'));
      },
      error: (er) => { this.guardandoDatos.set(false); this.errorDatos.set(leerError(er, this.i18n.t('errorCarga'))); },
    });
  }

  protected reenviar(): void {
    const p = this.perfil();
    if (!p) return;
    this.api.reenviarVerificacion(p.correo).subscribe({
      next: (r) => this.avisoCorreo.set(r.mensajes?.[0] ?? this.i18n.t('olvideListo')),
      error: (er) => this.errorDatos.set(leerError(er, this.i18n.t('errorCarga'))),
    });
  }

  protected campoDatos(n: string): string | null {
    return this.errorDatos().campos[n] ?? null;
  }

  protected miembroDesde(): string {
    const p = this.perfil();
    return p ? this.i18n.tf('perfilMiembro', { fecha: this.i18n.fecha(soloFecha(p.creadoEn), { month: 'long', year: 'numeric' }) }) : '';
  }

  // ---------------- seguridad ----------------

  private cargarSesiones(): void {
    this.falloSesiones.set(false);
    this.api.sesiones().subscribe({
      next: (l) => this.sesiones.set(l),
      error: () => { this.sesiones.set([]); this.falloSesiones.set(true); },
    });
  }

  protected reintentarSesiones(): void {
    this.sesiones.set(null);
    this.cargarSesiones();
  }

  protected cerrarSesion(s: SesionActiva): void {
    if (this.cerrandoSesion()) return;
    this.cerrandoSesion.set(s.id);
    this.avisoSesiones.set(null);
    this.errorSesiones.set(null);
    this.api.cerrarSesion(s.id).subscribe({
      next: (r) => {
        this.cerrandoSesion.set(null);
        this.sesiones.set((this.sesiones() ?? []).filter((x) => x.id !== s.id));
        this.avisoSesiones.set(r.mensajes?.[0] ?? this.i18n.t('perfilSesionCerrada'));
      },
      error: (er) => { this.cerrandoSesion.set(null); this.errorSesiones.set(leerError(er, this.i18n.t('errorCarga')).general); },
    });
  }

  protected cerrarOtras(): void {
    if (this.cerrandoSesion()) return;
    const ids = otrasSesiones(this.sesiones() ?? []).map((s) => s.id);
    this.cerrandoSesion.set('todas');
    this.avisoSesiones.set(null);
    this.errorSesiones.set(null);
    this.api.cerrarSesiones(ids).subscribe({
      next: () => {
        this.cerrandoSesion.set(null);
        this.sesiones.set((this.sesiones() ?? []).filter((x) => x.actual));
        this.avisoSesiones.set(this.i18n.t('perfilSesionesCerradas'));
      },
      // Si alguna falló, se vuelve a pedir la lista para mostrar lo que de verdad quedó abierto.
      error: () => { this.cerrandoSesion.set(null); this.errorSesiones.set(this.i18n.t('errorCarga')); this.reintentarSesiones(); },
    });
  }

  protected nombrePlataforma(s: SesionActiva): string {
    const base = this.i18n.t(plataformaClave(s.plataforma));
    return s.versionApp ? `${base} · ${this.i18n.tf('perfilVersion', { v: s.versionApp })}` : base;
  }

  protected detalleSesion(s: SesionActiva): string {
    return `${this.i18n.tf('perfilIniciada', { fecha: this.i18n.fecha(soloFecha(s.creadoEn)) })} · ${this.i18n.tf('perfilExpira', { fecha: this.i18n.fecha(soloFecha(s.expiraEn)) })}`;
  }

  protected cambiarClave(): void {
    if (this.cambiandoClave()) return;
    this.avisoClave.set(null);
    this.errorClave.set(SIN_ERROR);
    const e = validarClave(this.claveActual, this.claveNueva, this.claveRepetir);
    this.erroresClave.set(e);
    if (hayErrores(e)) return;
    this.cambiandoClave.set(true);
    this.api.cambiarClave(this.claveActual, this.claveNueva).subscribe({
      next: (r) => {
        this.cambiandoClave.set(false);
        this.claveActual = this.claveNueva = this.claveRepetir = '';
        this.avisoClave.set(r.mensajes?.[0] ?? this.i18n.t('perfilClaveListo'));
        this.reintentarSesiones();
      },
      error: (er) => { this.cambiandoClave.set(false); this.errorClave.set(leerError(er, this.i18n.t('errorCarga'))); },
    });
  }

  protected campoClave(n: string): string | null {
    return this.errorClave().campos[n] ?? null;
  }

  // ---------------- privacidad ----------------

  private cargarPrivacidad(): void {
    this.falloPrivacidad.set(false);
    let pendientes = 2;
    const listo = () => { if (--pendientes === 0 && this.consentimientos() === null) this.consentimientos.set([]); };
    this.api.consentimientos().subscribe({
      next: (l) => this.consentimientos.set(l),
      error: () => { this.falloPrivacidad.set(true); listo(); listo(); },
    });
    this.api.solicitudes().subscribe({
      next: (l) => { this.solicitudes.set(l); listo(); },
      error: () => { this.solicitudes.set([]); this.falloPrivacidad.set(true); listo(); },
    });
  }

  protected reintentarPrivacidad(): void {
    this.consentimientos.set(null);
    this.solicitudes.set(null);
    this.cargarPrivacidad();
  }

  protected activa(t: TipoConsentimiento): boolean {
    return consentimientoVigente(this.consentimientos() ?? [], t);
  }

  protected fechaPref(t: TipoConsentimiento): string | null {
    const f = fechaConsentimiento(this.consentimientos() ?? [], t);
    return f ? this.i18n.tf('perfilActualizada', { fecha: this.i18n.fecha(soloFecha(f)) }) : null;
  }

  protected alternarPref(t: TipoConsentimiento): void {
    if (this.guardandoPref()) return;
    this.guardandoPref.set(t);
    this.avisoPref.set(null);
    this.errorPref.set(null);
    const nuevo = !this.activa(t);
    this.api.registrarConsentimiento(t, nuevo).subscribe({
      next: (r) => {
        this.guardandoPref.set(null);
        // El historial manda: se agrega el registro nuevo en lugar de volver a pedir todo.
        this.consentimientos.set([...(this.consentimientos() ?? []), { tipo: t, versionTexto: '1', aceptado: nuevo, fecha: new Date().toISOString() }]);
        this.avisoPref.set(r.mensajes?.[0] ?? this.i18n.t('perfilPrefGuardada'));
      },
      error: (er) => { this.guardandoPref.set(null); this.errorPref.set(leerError(er, this.i18n.t('errorCarga')).general); },
    });
  }

  protected claveTipo(t: TipoSolicitud): { titulo: Clave; texto: Clave } {
    switch (t) {
      case 'acceso': return { titulo: 'perfilSolAcceso', texto: 'perfilSolAccesoTexto' };
      case 'rectificacion': return { titulo: 'perfilSolRectificacion', texto: 'perfilSolRectificacionTexto' };
      case 'cancelacion': return { titulo: 'perfilSolCancelacion', texto: 'perfilSolCancelacionTexto' };
      default: return { titulo: 'perfilSolOposicion', texto: 'perfilSolOposicionTexto' };
    }
  }

  protected elegirSolicitud(t: TipoSolicitud): void {
    this.tipoSolicitud.set(t);
    this.avisoSolicitud.set(null);
    this.errorSolicitud.set(null);
  }

  protected enviarSolicitud(): void {
    const t = this.tipoSolicitud();
    if (this.enviandoSolicitud()) return;
    this.avisoSolicitud.set(null);
    if (!t) { this.errorSolicitud.set(this.i18n.t('perfilElegirSolicitud')); return; }
    if (this.yaAbierta()) { this.errorSolicitud.set(this.i18n.t('perfilSolicitudAbierta')); return; }
    this.errorSolicitud.set(null);
    this.enviandoSolicitud.set(true);
    this.api.crearSolicitud(t, this.detalle.trim() || null).subscribe({
      next: (r) => {
        this.enviandoSolicitud.set(false);
        this.detalle = '';
        this.tipoSolicitud.set(null);
        this.solicitudes.set([...(this.solicitudes() ?? []), r.datos]);
        this.avisoSolicitud.set(r.mensajes?.[0] ?? this.i18n.t('perfilSolicitudEnviada'));
      },
      error: (er) => { this.enviandoSolicitud.set(false); this.errorSolicitud.set((leerError(er, this.i18n.t('errorCarga')).general) ?? this.i18n.t('errorCarga')); },
    });
  }

  protected claveEstado(s: SolicitudPrivacidad): Clave {
    switch (s.estado) {
      case 'en_proceso': return 'perfilEstadoEnProceso';
      case 'resuelta': return 'perfilEstadoResuelta';
      case 'rechazada': return 'perfilEstadoRechazada';
      default: return 'perfilEstadoRecibida';
    }
  }

  protected claseEstado = claseEstado;

  protected fechaSolicitud(s: SolicitudPrivacidad): string {
    const base = this.i18n.tf('perfilEnviadaEl', { fecha: this.i18n.fecha(soloFecha(s.creadoEn)) });
    return s.resueltaEn ? `${base} · ${this.i18n.t(this.claveEstado(s))} ${this.i18n.tf('perfilResueltaEl', { fecha: this.i18n.fecha(soloFecha(s.resueltaEn)) })}` : base;
  }

  // ---------------- salir ----------------

  protected salir(): void {
    this.saliendo = true;
    const t = this.sesion.tokenRenovacion();
    if (t) this.api.salir(t).subscribe({ error: () => undefined });
    this.sesion.cerrarLocal();
    void this.router.navigate(['/', this.i18n.lang()]);
  }
}
