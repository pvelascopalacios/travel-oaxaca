import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Api } from './api';
import { TipoFavorito } from './modelos';
import { Sesion } from './sesion';

/** Lo que la persona tiene guardado, para pintar el corazón en las fichas sin pedir la lista cada vez. */
@Injectable({ providedIn: 'root' })
export class Favoritos {
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);
  private readonly claves = signal<ReadonlySet<string>>(new Set());
  readonly cargado = signal(false);
  readonly total = computed(() => this.claves().size);

  constructor() {
    effect(() => {
      // Al entrar o salir de la sesión se vuelve a leer la lista (o se vacía).
      if (!this.sesion.listo()) return;
      if (this.sesion.autenticado()) this.recargar();
      else {
        this.claves.set(new Set());
        this.cargado.set(false);
      }
    });
  }

  private static clave(tipo: TipoFavorito, id: string): string {
    return `${tipo}:${id}`;
  }

  recargar(): void {
    this.api.favoritos().subscribe({
      next: (lista) => {
        this.claves.set(new Set(lista.map((f) => Favoritos.clave(f.tipo, f.id))));
        this.cargado.set(true);
      },
      error: () => this.cargado.set(true),
    });
  }

  esta(tipo: TipoFavorito, id: string): boolean {
    return this.claves().has(Favoritos.clave(tipo, id));
  }

  /** Guarda o quita. Se pinta al instante y, si la API falla, se regresa a como estaba. */
  alternar(tipo: TipoFavorito, id: string, alFallar: () => void): void {
    const k = Favoritos.clave(tipo, id);
    const estaba = this.claves().has(k);
    const nuevo = new Set(this.claves());
    if (estaba) nuevo.delete(k);
    else nuevo.add(k);
    this.claves.set(nuevo);
    (estaba ? this.api.quitarFavorito(tipo, id) : this.api.guardarFavorito(tipo, id)).subscribe({
      error: () => {
        const revertido = new Set(this.claves());
        if (estaba) revertido.add(k);
        else revertido.delete(k);
        this.claves.set(revertido);
        alFallar();
      },
    });
  }
}
