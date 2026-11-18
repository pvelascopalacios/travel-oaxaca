import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Categoria, DetalleRevision } from '../../core/modelos';
import { ErrorApi, MOTIVO_FICHA, esperaTexto, fechaHora, filasDeCambios, leerError, nombreCategoria, tipoColaInfo } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { Rechazo } from '../../shared/rechazo';

const IDIOMAS: Record<string, string> = { es: 'Español', en: 'English', zap: 'Zapoteco', mix: 'Mixteco' };

/** Todo lo que hace falta para decidir sobre una ficha nueva o sus cambios: qué cambió, quién la envió y la decisión. */
@Component({
  selector: 'app-detalle',
  imports: [RouterLink, Rechazo],
  templateUrl: './detalle.html',
  styleUrl: './detalle.scss',
})
export class Detalle implements OnInit {
  /** Viene de la dirección: /revision/negocios/:id */
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);

  protected readonly datos = signal<DetalleRevision | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly trabajando = signal<'aprobar' | 'rechazar' | null>(null);
  protected readonly rechazando = signal(false);
  protected readonly errorAccion = signal<string | null>(null);

  protected readonly MOTIVO = MOTIVO_FICHA;
  protected readonly tipoInfo = tipoColaInfo;
  protected readonly hora = fechaHora;
  protected readonly idiomas = IDIOMAS;

  protected readonly filas = computed(() => filasDeCambios(this.datos()?.ficha.revisionVigente?.cambios, this.arbol()));
  protected readonly hayIncompletos = computed(() => this.filas().some((f) => f.incompleto));
  protected readonly categoria = computed(() => nombreCategoria(this.arbol(), this.datos()?.ficha.categoriaClave ?? ''));
  protected readonly esNueva = computed(() => this.datos()?.tipo === 'ficha_nueva');
  protected readonly espera = computed(() => {
    const e = this.datos()?.enviadaEn;
    return e ? esperaTexto((Date.now() - new Date(e).getTime()) / 3_600_000) : '';
  });
  protected readonly idiomasConTexto = computed(() => Object.entries(this.datos()?.ficha.traducciones ?? {}).filter(([, t]) => t && (t.nombre || t.descripcionCorta || t.descripcion)));
  protected readonly portada = computed(() => this.datos()?.ficha.medios.find((m) => m.esPortada)?.url ?? this.datos()?.ficha.medios[0]?.url ?? null);

  ngOnInit(): void {
    this.cargar();
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.detalle(this.id()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar esta solicitud. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  protected aprobar(): void {
    if (this.trabajando()) return;
    this.errorAccion.set(null);
    this.trabajando.set('aprobar');
    this.api.aprobarNegocio(this.id()).subscribe({
      next: (r) => this.terminar(r.mensajes?.[0] ?? 'Aprobado.'),
      error: (e) => this.fallar(e),
    });
  }

  protected rechazar(motivo: string): void {
    if (this.trabajando()) return;
    this.errorAccion.set(null);
    this.trabajando.set('rechazar');
    this.api.rechazarNegocio(this.id(), motivo).subscribe({
      next: (r) => this.terminar(r.mensajes?.[0] ?? 'Rechazado.'),
      error: (e) => this.fallar(e),
    });
  }

  private terminar(mensaje: string): void {
    this.trabajando.set(null);
    this.pendientes.aviso.set(mensaje);
    this.pendientes.refrescar();
    void this.router.navigate(['/revision']);
  }

  private fallar(e: unknown): void {
    this.trabajando.set(null);
    this.errorAccion.set(leerError(e).general);
  }
}
