import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Historial } from '../../core/modelos';
import { ErrorApi, fechaHora, leerError, resultadoInfo, tipoColaInfo } from '../../core/panel';

/** Revisiones ya resueltas: qué se decidió, quién y con qué motivo. */
@Component({
  selector: 'app-historial',
  imports: [RouterLink],
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class HistorialPagina {
  /** Viene de la dirección: /revision/historial?pagina=2 */
  readonly pagina = input<string>();
  private readonly api = inject(Api);

  protected readonly filas = signal<Historial[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);

  protected readonly nPagina = () => Math.max(0, (Number(this.pagina()) || 1) - 1);
  protected readonly hayAnterior = () => this.nPagina() > 0;
  protected readonly haySiguiente = () => (this.nPagina() + 1) * this.tamano < this.total();
  protected readonly desde = () => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1);
  protected readonly hasta = () => Math.min(this.total(), (this.nPagina() + 1) * this.tamano);
  protected readonly hora = fechaHora;
  protected readonly resultado = resultadoInfo;
  protected readonly tipo = tipoColaInfo;

  constructor() {
    effect(() => {
      this.pagina();
      this.cargar();
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.historial(this.nPagina(), this.tamano).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar el historial. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  protected enlace(h: Historial): unknown[] | null {
    return h.tipo === 'foto' ? null : ['/revision/negocios', h.negocioId];
  }
}
