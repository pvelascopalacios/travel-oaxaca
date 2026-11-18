import { Component, inject, input, output, signal } from '@angular/core';
import { Api } from '../core/api';
import { leerError } from '../core/panel';

export const MAX_BYTES = 10 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** Por qué no se puede subir este archivo (o null si está bien). La API vuelve a validar igual. */
export function errorDeArchivo(a: { type: string; size: number }): string | null {
  if (!TIPOS_FOTO.includes(a.type)) return 'Solo se aceptan fotos JPEG, PNG o WebP.';
  if (a.size <= 0) return 'El archivo está vacío.';
  if (a.size > MAX_BYTES) return `La foto pesa demasiado. El máximo es ${MAX_BYTES / 1048576} MB.`;
  return null;
}

export interface FotoSubida {
  medioId: string;
  url: string;
}

/** Sube fotos en tres pasos (URL firmada → almacén → confirmar) y avisa de cada una que quedó lista. */
@Component({
  selector: 'app-subir-foto',
  template: `
    <div class="sube">
      <label class="boton-sube" [class.off]="ocupado() || deshabilitado()">
        <input type="file" accept="image/jpeg,image/png,image/webp" [multiple]="multiple()" [disabled]="ocupado() || deshabilitado()" (change)="elegir($event)" />
        {{ ocupado() ? 'Subiendo… ' + avance() + ' %' : texto() }}
      </label>
      @if (error(); as e) { <p class="aviso" role="alert">{{ e }}</p> }
    </div>
  `,
  styles: `
    .sube { display: grid; gap: 8px; }
    .boton-sube { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1.5px solid var(--linea); background: var(--papel); color: var(--tinta); font: 700 0.9rem var(--fuente); cursor: pointer; position: relative; width: fit-content; }
    .boton-sube.off { opacity: 0.5; cursor: not-allowed; }
    .boton-sube input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
    .boton-sube.off input { cursor: not-allowed; }
  `,
})
export class SubirFoto {
  readonly texto = input('Subir foto');
  readonly multiple = input(false);
  readonly deshabilitado = input(false);
  /** Cuántas fotos más caben (solo con varias). */
  readonly cupo = input<number | null>(null);
  readonly lista = output<FotoSubida>();

  private readonly api = inject(Api);
  protected readonly ocupado = signal(false);
  protected readonly avance = signal(0);
  protected readonly error = signal<string | null>(null);

  protected async elegir(ev: Event): Promise<void> {
    const entrada = ev.target as HTMLInputElement;
    let archivos = Array.from(entrada.files ?? []);
    entrada.value = '';
    if (!archivos.length) return;
    this.error.set(null);
    const cupo = this.cupo();
    if (cupo !== null && archivos.length > cupo) {
      this.error.set(cupo === 0 ? 'Ya no caben más fotos.' : `Solo caben ${cupo} foto${cupo === 1 ? '' : 's'} más.`);
      archivos = archivos.slice(0, Math.max(0, cupo));
    }
    this.ocupado.set(true);
    for (const a of archivos) {
      const malo = errorDeArchivo(a);
      if (malo) { this.error.set(`${a.name}: ${malo}`); continue; }
      try {
        this.avance.set(0);
        const s = (await this.promesa(this.api.solicitarSubida(a.type, a.size))).datos!;
        await new Promise<void>((ok, mal) => this.api.subirArchivo(s, a).subscribe({ next: (n) => this.avance.set(n), error: mal, complete: ok }));
        const m = (await this.promesa(this.api.confirmarSubida(s.medioId))).datos!;
        this.lista.emit({ medioId: m.id, url: m.url });
      } catch (e) {
        const x = e as { status?: number };
        this.error.set(x?.status === undefined || x.status === 0
          ? `${a.name}: no se pudo subir al almacén de fotos. Revisa tu conexión y el CORS del bucket.`
          : `${a.name}: ${leerError(e).general}`);
      }
    }
    this.ocupado.set(false);
  }

  private promesa<T>(o: import('rxjs').Observable<T>): Promise<T> {
    return new Promise((ok, mal) => o.subscribe({ next: ok, error: mal }));
  }
}
