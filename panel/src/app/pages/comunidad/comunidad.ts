import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { Api } from '../../core/api';
import { AccionCola, AccionDisponible, ICONO_TIPO, TIPOS_COLA, accionPorTecla, accionesDe, errorDeMotivoFoto, estadoColaTexto, teclaDe, tipoColaTexto, urgenciaComunidad, MOTIVO_FOTO_MAX } from '../../core/comunidad';
import { ItemComunidad } from '../../core/modelos';
import { ErrorApi, esperaTexto, fechaHora, leerError } from '../../core/panel';
import { moverIndice } from '../../core/ui';
import { Pendientes } from '../../core/pendientes';
import { NegocioElegido, SelectorNegocio } from '../../shared/selector-negocio';
import { VacioEstado } from '../../shared/vacio';
import { enlazarAviso } from '../../core/avisos';

const HECHO: Record<string, string> = {
  publicar: 'Publicado.', ocultar: 'Ocultado.', rechazar: 'Rechazado.', aprobar: 'Foto aprobada.',
  revisar: 'Reporte marcado en revisión.', resolver: 'Reporte resuelto.', descartar: 'Reporte descartado.',
};

/** Cola de moderación de la comunidad: reseñas, comentarios, fotos de reseñas y reportes. */
@Component({
  selector: 'app-comunidad',
  imports: [FormsModule, RouterLink, SelectorNegocio, VacioEstado],
  templateUrl: './comunidad.html',
  styleUrl: './comunidad.scss',
})
export class Comunidad {
  /** /comunidad?tipo=resena&negocioId=…&negocioNombre=…&pagina=2 */
  readonly tipo = input<string>();
  readonly negocioId = input<string>();
  readonly negocioNombre = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);

  protected readonly tipos = TIPOS_COLA;
  protected readonly items = signal<ItemComunidad[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly conteos = signal<Record<string, number>>({});
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  /** Elemento con una acción en curso. */
  protected readonly trabajando = signal<string | null>(null);
  protected readonly errorItem = signal<{ id: string; texto: string } | null>(null);
  /** Foto cuyo rechazo está abierto, con su motivo. */
  protected readonly rechazando = signal<string | null>(null);
  protected motivo = '';
  protected readonly errorMotivo = signal<string | null>(null);
  protected readonly motivoMax = MOTIVO_FOTO_MAX;

  /** Caso abierto a la derecha (posición en la lista de esta página). */
  protected readonly indice = signal(0);
  protected readonly actual = computed(() => this.items()[this.indice()] ?? null);
  /** Elemento cuyo rechazo (sin motivo) espera una segunda confirmación. */
  protected readonly confirmando = signal<string | null>(null);

  protected readonly icono = (tipo: string): string => ICONO_TIPO[tipo] ?? ICONO_TIPO['resena'];
  protected readonly tecla = teclaDe;
  protected readonly hora = fechaHora;
  protected readonly estadoTexto = estadoColaTexto;
  protected readonly tipoTexto = tipoColaTexto;
  protected readonly acciones = accionesDe;
  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly tipoActual = computed(() => (this.tipos.some((t) => t.clave === this.tipo()) ? this.tipo()! : ''));
  protected readonly totalGeneral = computed(() => Object.values(this.conteos()).reduce((a, b) => a + b, 0));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));
  protected readonly negocioElegido = computed<NegocioElegido | null>(() => (this.negocioId() ? { id: this.negocioId()!, nombre: this.negocioNombre() || 'Negocio elegido' } : null));

  constructor() {
    effect(() => {
      this.tipo();
      this.pagina();
      this.negocioId();
      this.indice.set(0);
      this.confirmando.set(null);
      this.cargar();
    });
    effect(() => {
      this.negocioId();
      this.contar();
    });
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { tipo: this.tipoActual() || null, negocioId: this.negocioId() || null, negocioNombre: this.negocioNombre() || null, pagina: null, ...extra };
  }

  protected elegirNegocio(n: NegocioElegido | null): void {
    void this.router.navigate([], { queryParams: this.consulta({ negocioId: n?.id ?? null, negocioNombre: n?.nombre ?? null }) });
  }

  protected horas(i: ItemComunidad): number {
    return (Date.now() - new Date(i.creadoEn).getTime()) / 3600000;
  }
  protected espera(i: ItemComunidad): string {
    return esperaTexto(this.horas(i));
  }
  protected urgencia(i: ItemComunidad): 'urg' | 'cambio' | '' {
    return urgenciaComunidad(i, this.horas(i));
  }

  protected elegir(n: number): void {
    const largo = this.items().length;
    if (largo === 0) return;
    this.indice.set(Math.min(largo - 1, Math.max(0, n)));
    this.rechazando.set(null);
    this.confirmando.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  protected teclado(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    const n = this.items().length;
    const k = e.key.toLowerCase();
    if (k === 'j') return this.elegir(moverIndice(this.indice(), 1, n));
    if (k === 'k') return this.elegir(moverIndice(this.indice(), -1, n));
    const i = this.actual();
    const a = i ? accionPorTecla(i, k) : null;
    if (i && a) {
      e.preventDefault();
      this.ejecutar(i, a);
    }
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.colaComunidad({ tipo: this.tipoActual() || null, negocioId: this.negocioId() || null, pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.items.set(p.elementos);
        this.total.set(p.total);
        this.indice.set(Math.min(this.indice(), Math.max(0, p.elementos.length - 1)));
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar la cola. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  /** Cuántos hay de cada tipo (una llamada por tipo, de tamaño 1). */
  private contar(): void {
    const n = this.negocioId() || null;
    forkJoin(this.tipos.map((t) => this.api.colaComunidad({ tipo: t.clave, negocioId: n, tamano: 1 }).pipe(catchError(() => of(null))))).subscribe((r) => {
      const c: Record<string, number> = {};
      this.tipos.forEach((t, i) => { if (r[i]) c[t.clave] = r[i]!.total; });
      this.conteos.set(c);
      if (!n && r.every((x) => x)) this.pendientes.comunidad.set(Object.values(c).reduce((a, b) => a + b, 0));
    });
  }

  protected ejecutar(i: ItemComunidad, a: AccionDisponible): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorItem.set(null);
    // Rechazar sin motivo no se puede deshacer: pide una segunda confirmación (también con el teclado).
    if (a.accion === 'rechazar' && !a.pideMotivo && this.confirmando() !== i.id) {
      this.confirmando.set(i.id);
      return;
    }
    this.confirmando.set(null);
    if (a.pideMotivo) {
      this.rechazando.set(this.rechazando() === i.id ? null : i.id);
      this.motivo = '';
      this.errorMotivo.set(null);
      return;
    }
    this.enviar(i, a.accion);
  }

  protected enviarRechazo(i: ItemComunidad): void {
    this.confirmando.set(null);
    this.enviar(i, 'rechazar');
  }

  protected confirmarRechazo(i: ItemComunidad): void {
    const e = errorDeMotivoFoto(this.motivo);
    this.errorMotivo.set(e);
    if (e) return;
    this.enviar(i, 'rechazar', this.motivo.trim());
  }

  private enviar(i: ItemComunidad, accion: AccionCola, motivo?: string): void {
    this.trabajando.set(i.id);
    this.api.accionComunidad(i.tipo, i.id, accion, motivo).subscribe({
      next: (r) => {
        this.trabajando.set(null);
        this.rechazando.set(null);
        this.aviso.set(r.mensajes?.[0] ?? HECHO[accion] ?? 'Listo.');
        this.cargar();
        this.contar();
      },
      error: (e) => {
        this.trabajando.set(null);
        const er = leerError(e);
        this.errorItem.set({ id: i.id, texto: er.campos['motivo'] ?? er.general ?? 'No se pudo completar.' });
        // si alguien más ya lo resolvió, la lista se actualiza para que desaparezca
        if (e?.status === 409 || e?.status === 404) { this.cargar(); this.contar(); }
      },
    });
  }
}
