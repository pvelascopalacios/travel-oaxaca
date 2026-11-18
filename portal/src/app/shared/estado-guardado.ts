import { Component, input } from '@angular/core';
import { Envio, textoDeResultado } from '../core/envio';

/** Lo que pasó con el último guardado de una sección: éxito, espera de revisión o el error de la API. */
@Component({
  selector: 'app-estado-guardado',
  template: `
    @if (envio().error().general; as g) {
      <p class="aviso" role="alert">{{ g }}</p>
    }
    @if (texto(); as t) {
      <p class="estado-g" [class.espera]="envio().resultado() !== 'ok'" role="status">{{ t }}</p>
    }
  `,
  styles: `
    .estado-g { font-weight: 600; font-size: 0.88rem; color: var(--sierra); margin: 0; }
    .estado-g.espera { padding: 10px 12px; border-radius: 12px; background: var(--ambar); color: var(--ambar-texto); font-weight: 500; }
  `,
})
export class EstadoGuardado {
  readonly envio = input.required<Envio>();
  protected texto(): string | null {
    return textoDeResultado(this.envio().resultado());
  }
}
