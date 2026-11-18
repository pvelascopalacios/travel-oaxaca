import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { Api } from '../../core/api';
import {
  FormVerificacion, METODOS_VERIFICACION, diasEntre, diasTexto, errorDeVerificacion, estadoNegocioInfo, estadoSuscripcion, fechaLarga, formVerificacionVacio,
  hoyIso, metodoVerificacionTexto, dinero, ordenarSuscripciones, periodoTexto, suscripcionVigente, verificacionParaApi, verificacionVigente,
} from '../../core/cobros';
import { Categoria, FichaRevision, Suscripcion, Verificacion } from '../../core/modelos';
import { ErrorApi, leerError, nombreCategoria, tieneAlgunRol } from '../../core/panel';
import { Sesion } from '../../core/sesion';
import { aPorcentaje, colorAvatar, iniciales, puntajeColor } from '../../core/ui';
import { VacioEstado } from '../../shared/vacio';

const IDIOMAS: Record<string, string> = { es: 'Español', en: 'English', zap: 'Zapoteco', mix: 'Mixteco' };

/** Un negocio visto por el equipo: su ficha, su plan y su verificación. */
@Component({
  selector: 'app-negocio',
  imports: [FormsModule, RouterLink, VacioEstado],
  templateUrl: './negocio.html',
  styleUrl: './negocio.scss',
})
export class Negocio implements OnInit {
  /** /negocios/:id?tab=ficha|plan|verificacion */
  readonly id = input.required<string>();
  readonly tab = input<string>();

  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);

  protected readonly ficha = signal<FichaRevision | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly suscripciones = signal<Suscripcion[] | null>(null);
  protected readonly falloPlan = signal<string | null>(null);
  protected readonly verificaciones = signal<Verificacion[] | null>(null);
  protected readonly falloVerif = signal<string | null>(null);

  protected readonly tabActual = computed(() => (['plan', 'verificacion'].includes(this.tab() ?? '') ? this.tab()! : 'ficha'));
  protected readonly puedeCobrar = computed(() => tieneAlgunRol(this.sesion.usuario()?.roles, ['admin', 'ventas']));
  protected readonly puedeVerificar = computed(() => tieneAlgunRol(this.sesion.usuario()?.roles, ['admin', 'editor']));

  protected readonly puedeRevisar = computed(() => tieneAlgunRol(this.sesion.usuario()?.roles, ['admin', 'editor']));
  protected readonly iniciales = iniciales;
  protected readonly colorAvatar = colorAvatar;
  protected readonly puntajeColor = puntajeColor;
  protected readonly porcentaje = aPorcentaje;
  protected readonly municipio = computed(() => this.ficha()?.sucursales?.[0]?.municipioNombre ?? null);

  protected readonly estadoInfo = estadoNegocioInfo;
  protected readonly estSus = estadoSuscripcion;
  protected readonly fecha = fechaLarga;
  protected readonly dinero = dinero;
  protected readonly periodo = periodoTexto;
  protected readonly metodoV = metodoVerificacionTexto;
  protected readonly metodos = METODOS_VERIFICACION;
  protected readonly idiomas = IDIOMAS;
  protected readonly hoy = hoyIso();

  protected readonly categoria = computed(() => nombreCategoria(this.arbol(), this.ficha()?.categoriaClave ?? ''));
  protected readonly portada = computed(() => this.ficha()?.medios.find((m) => m.esPortada)?.url ?? this.ficha()?.medios[0]?.url ?? null);
  protected readonly idiomasConTexto = computed(() => Object.entries(this.ficha()?.traducciones ?? {}).filter(([, t]) => t && (t.nombre || t.descripcionCorta || t.descripcion)));
  protected readonly ordenadas = computed(() => ordenarSuscripciones(this.suscripciones() ?? []));
  protected readonly vigente = computed(() => suscripcionVigente(this.suscripciones() ?? []));
  protected readonly diasPlan = computed(() => { const v = this.vigente(); return v ? diasTexto(diasEntre(this.hoy, v.fin)) : ''; });
  protected readonly vigenteVerif = computed(() => verificacionVigente(this.verificaciones() ?? []));
  protected readonly ultimaVerif = computed(() => (this.verificaciones() ?? [])[0] ?? null);

  // cancelar
  protected readonly cancelando = signal(false);
  protected motivo = '';
  protected readonly errorMotivo = signal<string | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly avisoPlan = signal<string | null>(null);

  // verificar
  protected form: FormVerificacion = formVerificacionVacio();
  protected readonly erroresV = signal<Record<string, string>>({});
  protected readonly errorApiV = signal<string | null>(null);
  protected readonly avisoV = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.id();
      this.ficha.set(null);
      this.suscripciones.set(null);
      this.verificaciones.set(null);
      this.cargar();
    });
  }

  ngOnInit(): void {
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.negocio(this.id()).subscribe({
      next: (f) => { this.ficha.set(f); this.cargando.set(false); this.cargarSecundarios(); },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar este negocio. Inténtalo de nuevo.')); this.cargando.set(false); },
    });
  }

  private cargarSecundarios(): void {
    this.falloPlan.set(null);
    this.falloVerif.set(null);
    this.api.suscripciones(this.id()).subscribe({
      next: (l) => this.suscripciones.set(l),
      error: (e) => this.falloPlan.set(leerError(e, 'No pudimos cargar el plan.').general),
    });
    this.api.verificaciones(this.id()).subscribe({
      next: (l) => this.verificaciones.set([...l].sort((a, b) => b.fecha.localeCompare(a.fecha))),
      error: (e) => this.falloVerif.set(leerError(e, 'No pudimos cargar las verificaciones.').general),
    });
  }

  protected abrirCancelar(): void { this.cancelando.set(true); this.motivo = ''; this.errorMotivo.set(null); this.avisoPlan.set(null); }

  protected cancelar(): void {
    const v = this.vigente();
    if (!v || this.trabajando()) return;
    const m = this.motivo.trim();
    if (!m) { this.errorMotivo.set('Escribe el motivo.'); return; }
    if (m.length > 300) { this.errorMotivo.set('Máximo 300 caracteres.'); return; }
    this.trabajando.set(true);
    this.errorMotivo.set(null);
    this.api.cancelarSuscripcion(v.id, m).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.cancelando.set(false);
        this.avisoPlan.set(r.mensajes?.[0] ?? 'Suscripción cancelada. El negocio vuelve al plan Gratis.');
        this.api.suscripciones(this.id()).subscribe({ next: (l) => this.suscripciones.set(l), error: () => undefined });
      },
      error: (e) => { this.trabajando.set(false); this.errorMotivo.set(leerError(e).general); },
    });
  }

  protected verificar(): void {
    if (this.trabajando()) return;
    this.avisoV.set(null);
    this.errorApiV.set(null);
    const errores = errorDeVerificacion(this.form);
    this.erroresV.set(errores);
    if (Object.keys(errores).length) return;
    this.trabajando.set(true);
    this.api.registrarVerificacion(this.id(), verificacionParaApi(this.form)).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.avisoV.set(r.mensajes?.[0] ?? 'Verificación registrada.');
        this.form = formVerificacionVacio();
        this.api.verificaciones(this.id()).subscribe({ next: (l) => this.verificaciones.set([...l].sort((a, b) => b.fecha.localeCompare(a.fecha))), error: () => undefined });
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApiV.set(er.general);
        if (er.campos) this.erroresV.set(er.campos);
      },
    });
  }
}
