import { Injectable, WritableSignal, effect, inject, signal, untracked } from '@angular/core';

export interface AccionAviso {
  texto: string;
  hacer: () => void;
}

export interface Aviso {
  id: number;
  tipo: 'ok' | 'error';
  texto: string;
  accion?: AccionAviso;
}

/** Cuántos avisos caben a la vez; el más viejo se va primero. */
export const MAX_AVISOS = 3;
/** Milisegundos que un aviso de éxito queda a la vista. */
export const DURACION_OK = 5000;

/** Avisos flotantes de todo el panel (guardado, errores). Los dibuja el layout. */
@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private n = 0;

  /** Éxito: se cierra solo. Un éxito borra los errores que seguían a la vista. */
  ok(texto: string): void {
    this.poner({ id: ++this.n, tipo: 'ok', texto }, (l) => l.filter((a) => a.tipo !== 'error' && !(a.tipo === 'ok' && a.texto === texto)));
  }

  /** Error: se queda hasta que se cierre. Con un texto repetido, no se apila. */
  error(texto: string, accion?: AccionAviso): void {
    this.poner({ id: ++this.n, tipo: 'error', texto, accion }, (l) => l.filter((a) => !(a.tipo === 'error' && a.texto === texto)));
  }

  cerrar(id: number): void {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }

  cerrarUltimo(): void {
    this.lista.update((l) => l.slice(0, -1));
  }

  private poner(nuevo: Aviso, filtrar: (l: Aviso[]) => Aviso[]): void {
    this.lista.update((l) => [...filtrar(l), nuevo].slice(-MAX_AVISOS));
  }
}

/** «No se guardó: revisa 2 campos.» si hay campos marcados; si no, el texto que dio el sistema. */
export function textoErrorFormulario(general: string | null | undefined, campos: number): string {
  if (campos > 0) return `No se guardó: revisa ${campos} ${campos === 1 ? 'campo' : 'campos'}.`;
  return (general ?? '').trim() || 'No se pudo completar. Inténtalo de nuevo.';
}

/** Baja al primer campo con problema y lo enfoca. Devuelve false si no hay ninguno. */
export function irAlPrimerError(doc: Document = document): boolean {
  const campo = doc.querySelector<HTMLElement>('main .error input, main .error select, main .error textarea, main .error button, main [aria-invalid="true"]');
  const bloque = campo ?? doc.querySelector<HTMLElement>('main .error, main [role="alert"]');
  if (!bloque) return false;
  const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  bloque.scrollIntoView({ block: 'center', behavior: reducir ? 'auto' : 'smooth' });
  if (campo) campo.focus({ preventScroll: true });
  return true;
}

/**
 * Pasa los mensajes de éxito de una página al aviso flotante: cuando la señal trae texto, se muestra y la señal se vacía.
 * Se llama dentro de un campo o del constructor (necesita el contexto de inyección).
 */
export function enlazarAviso(aviso: WritableSignal<string | null>): void {
  const avisos = inject(Avisos);
  effect(() => {
    const t = aviso();
    if (!t) return;
    avisos.ok(t);
    untracked(() => aviso.set(null));
  });
}

/** Resume un fallo al guardar en un aviso flotante, con salto al primer campo marcado. */
export function enlazarError(error: () => string | null, campos: () => Record<string, unknown> | null | undefined): void {
  const avisos = inject(Avisos);
  effect(() => {
    const e = error();
    if (!e) return;
    const n = untracked(() => Object.keys(campos() ?? {}).length);
    avisos.error(textoErrorFormulario(e, n), n > 0 ? { texto: 'Ir al primero', hacer: () => void irAlPrimerError() } : undefined);
  });
}
