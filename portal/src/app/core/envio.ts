import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Respuesta, ResultadoCambio } from './modelos';
import { ErrorApi, leerError } from './portal';

export type Resultado = 'ok' | 'pendiente' | 'parcial' | null;

const SIN_ERROR: ErrorApi = { general: null, campos: {} };

/**
 * Estado de un botón «Guardar»: si está trabajando, el error de la API (general y por campo) y cómo terminó el último guardado.
 * Cada sección del editor tiene el suyo, así un error en una no tapa a las demás.
 */
export class Envio {
  readonly trabajando = signal(false);
  readonly error = signal<ErrorApi>(SIN_ERROR);
  readonly resultado = signal<Resultado>(null);

  limpiar(): void {
    this.error.set(SIN_ERROR);
    this.resultado.set(null);
  }

  fallar(mensaje: string, campos: Record<string, string> = {}): void {
    this.error.set({ general: mensaje, campos });
    this.resultado.set(null);
  }

  campo(nombre: string): string | null {
    return this.error().campos[nombre] ?? null;
  }

  marcar(c: ResultadoCambio): void {
    this.resultado.set(c.pendienteDeRevision ? (c.aplicado ? 'parcial' : 'pendiente') : 'ok');
  }

  ejecutar(llamada: Observable<Respuesta<ResultadoCambio>>, alTerminar: (r: ResultadoCambio) => void): void {
    if (this.trabajando()) return;
    this.limpiar();
    this.trabajando.set(true);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.marcar(r.datos);
        alTerminar(r.datos);
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error.set(leerError(e));
      },
    });
  }
}

export function textoDeResultado(r: Resultado): string | null {
  switch (r) {
    case 'ok': return '✓ Guardado.';
    case 'parcial': return '✓ Guardado. Una parte de los cambios espera la revisión del equipo; mientras tanto se sigue mostrando la versión anterior de eso.';
    case 'pendiente': return '⏳ Enviado a revisión. La versión actual sigue visible hasta que el equipo la apruebe.';
    default: return null;
  }
}
