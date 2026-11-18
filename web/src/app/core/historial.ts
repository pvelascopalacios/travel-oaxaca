import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

const LLAVE = 'to.busquedas';
const MAXIMO = 5;

/** Últimas búsquedas del visitante, solo en su navegador. En el servidor siempre está vacío. */
@Injectable({ providedIn: 'root' })
export class Historial {
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  readonly recientes = signal<string[]>(this.leer());

  agregar(texto: string): void {
    const t = texto.trim();
    if (t.length < 2) return;
    const lista = [t, ...this.recientes().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAXIMO);
    this.recientes.set(lista);
    this.guardar(lista);
  }

  borrar(): void {
    this.recientes.set([]);
    this.guardar([]);
  }

  private leer(): string[] {
    if (!this.navegador) return [];
    try {
      const v = JSON.parse(localStorage.getItem(LLAVE) ?? '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAXIMO) : [];
    } catch {
      return [];
    }
  }

  private guardar(lista: string[]): void {
    if (!this.navegador) return;
    try {
      localStorage.setItem(LLAVE, JSON.stringify(lista));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }
}
