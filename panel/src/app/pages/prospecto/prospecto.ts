import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import { Categoria, Municipio, PersonaEquipo, ProspectoDetalle } from '../../core/modelos';
import { ErrorApi, categoriasPlanas, fechaCorta, fechaHora, leerError } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import {
  EstadoInfo, FormInteraccion, FormProspecto, MOTIVO_DESCARTE_MAX, ORIGENES, TIPOS_INTERACCION, errorDeDescarte, errorDeInteraccion, errorDeProspecto, estadoProspecto, estadosSiguientes,
  faltaParaConvertir, formDeProspecto, formInteraccionVacio, formProspectoVacio, hoyISO, interaccionParaApi, prospectoParaApi, puedeEliminar, tipoInteraccion,
} from '../../core/ventas';
import { SelectorMunicipio } from '../../shared/selector-municipio';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Un prospecto: datos, historial de contactos, cambio de estado, conversión a negocio y eliminación. */
@Component({
  selector: 'app-prospecto',
  imports: [FormsModule, RouterLink, SelectorMunicipio],
  templateUrl: './prospecto.html',
  styleUrl: './prospecto.scss',
})
export class Prospecto implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);
  protected readonly cat = inject(Catalogos);

  protected readonly nuevo = computed(() => this.id() === 'nuevo');
  protected readonly detalle = signal<ProspectoDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly trabajando = signal(false);

  protected form: FormProspecto = formProspectoVacio();
  protected readonly version = signal(0);
  protected inter: FormInteraccion = formInteraccionVacio();
  protected readonly erroresInter = signal<Record<string, string>>({});
  protected readonly errorInter = signal<string | null>(null);

  protected readonly equipo = signal<PersonaEquipo[]>([]);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly categorias = computed(() => categoriasPlanas(this.arbol()));
  protected readonly origenes = ORIGENES;
  protected readonly tiposInter = TIPOS_INTERACCION;
  protected readonly estadoInfo = estadoProspecto;
  protected readonly tipoInfo = tipoInteraccion;
  protected readonly fecha = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly hoy = hoyISO();
  protected readonly motivoMax = MOTIVO_DESCARTE_MAX;

  protected readonly p = computed(() => this.detalle()?.prospecto ?? null);
  protected readonly siguientes = computed<EstadoInfo[]>(() => (this.p() ? estadosSiguientes(this.p()!.estado) : []));
  protected readonly esConvertido = computed(() => this.p()?.estado === 'convertido');
  protected readonly sePuedeEliminar = computed(() => (this.p() ? puedeEliminar(this.p()!) : false));

  // acciones secundarias
  protected readonly descartando = signal(false);
  protected motivo = '';
  protected readonly errorMotivo = signal<string | null>(null);
  protected catConv = '';
  protected munConv = '';
  protected readonly erroresConv = signal<Record<string, string>>({});
  protected readonly errorConv = signal<string | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly accion = signal<string | null>(null);

  ngOnInit(): void {
    this.cat.cargar();
    const aviso = history.state?.['aviso'] as string | undefined;
    if (aviso) this.aviso.set(aviso);
    this.api.equipoVentas().subscribe({ next: (e) => this.equipo.set(e), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
    if (this.nuevo()) { this.cargando.set(false); return; }
    this.api.prospecto(this.id()).subscribe({
      next: (d) => { this.poner(d); this.cargando.set(false); },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar este prospecto.')); this.cargando.set(false); },
    });
  }

  private poner(d: ProspectoDetalle): void {
    this.detalle.set(d);
    this.form = formDeProspecto(d);
    this.catConv = d.prospecto.categoriaId ?? '';
    this.munConv = d.prospecto.municipioId ?? '';
    this.version.update((n) => n + 1);
  }

  protected cambio(): void { this.version.update((n) => n + 1); }
  protected elegirMunicipio(m: Municipio | null): void { this.form.municipioId = m?.id ?? ''; this.cambio(); }
  protected elegirMunicipioConv(m: Municipio | null): void { this.munConv = m?.id ?? ''; this.cambio(); }

  /** Recibe el detalle nuevo después de una acción y refresca el contador del menú. */
  private tras(d: ProspectoDetalle, mensaje: string): void {
    this.poner(d);
    this.aviso.set(mensaje);
    this.pendientes.refrescarProspectos();
  }

  protected guardar(): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const e = errorDeProspecto(this.form);
    this.errores.set(e);
    if (Object.keys(e).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.trabajando.set(true);
    const cuerpo = prospectoParaApi(this.form);
    const llamada = this.nuevo() ? this.api.crearProspecto(cuerpo) : this.api.actualizarProspecto(this.id(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.pendientes.refrescarProspectos();
        if (this.nuevo() && r.datos) { void this.router.navigate(['/prospectos', r.datos.prospecto.id], { state: { aviso: 'Prospecto creado.' } }); return; }
        if (r.datos) this.tras(r.datos, r.mensajes?.[0] ?? 'Prospecto guardado.');
      },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.general); if (x.campos) this.errores.set(x.campos); },
    });
  }

  protected registrarContacto(): void {
    if (this.trabajando()) return;
    this.errorInter.set(null);
    const e = errorDeInteraccion(this.inter);
    this.erroresInter.set(e);
    if (Object.keys(e).length) return;
    this.trabajando.set(true);
    this.api.interaccionProspecto(this.id(), interaccionParaApi(this.inter)).subscribe({
      next: (r) => { this.trabajando.set(false); this.inter = formInteraccionVacio(); if (r.datos) this.tras(r.datos, 'Contacto registrado.'); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorInter.set(x.general); if (x.campos) this.erroresInter.set(x.campos); },
    });
  }

  protected cambiarEstado(e: EstadoInfo): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    if (e.clave === 'descartado') { this.descartando.set(true); this.motivo = ''; this.errorMotivo.set(null); return; }
    this.enviarEstado(e.clave, null);
  }

  protected confirmarDescarte(): void {
    const m = errorDeDescarte(this.motivo);
    this.errorMotivo.set(m);
    if (m) return;
    this.enviarEstado('descartado', this.motivo.trim());
  }

  private enviarEstado(estado: string, motivo: string | null): void {
    this.trabajando.set(true);
    this.api.estadoProspecto(this.id(), estado, motivo).subscribe({
      next: (r) => { this.trabajando.set(false); this.descartando.set(false); if (r.datos) this.tras(r.datos, `Ahora está «${estadoProspecto(estado).texto}».`); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.campos['motivo'] ?? x.campos['estado'] ?? x.general); },
    });
  }

  protected convertir(): void {
    if (this.trabajando() || !this.p()) return;
    this.errorConv.set(null);
    const e = faltaParaConvertir(this.p()!, this.catConv, this.munConv);
    this.erroresConv.set(e);
    if (Object.keys(e).length) return;
    this.trabajando.set(true);
    this.api.convertirProspecto(this.id(), this.catConv || null, this.munConv || null).subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.pendientes.refrescarProspectos();
        if (r.datos) void this.router.navigate(['/negocios', r.datos.negocioId], { state: { aviso: 'Prospecto convertido: este es el negocio nuevo, en borrador. Completa su ficha.' } });
      },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorConv.set(x.general); if (x.campos) this.erroresConv.set(x.campos); },
    });
  }

  protected eliminar(): void {
    this.trabajando.set(true);
    this.api.eliminarProspecto(this.id()).subscribe({
      next: () => { this.pendientes.refrescarProspectos(); void this.router.navigate(['/prospectos']); },
      error: (er) => { this.trabajando.set(false); this.eliminando.set(false); this.errorApi.set(leerError(er).general); },
    });
  }
}
