import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { Api } from './api';
import { Idioma, Municipio, Region } from './modelos';

/** Catálogos que casi todas las pantallas de contenido necesitan: idiomas, regiones y municipios. Se piden una sola vez. */
@Injectable({ providedIn: 'root' })
export class Catalogos {
  private readonly api = inject(Api);
  readonly idiomas = signal<Idioma[]>([{ codigo: 'es', nombre: 'Español', esIndigena: false }]);
  readonly regiones = signal<Region[]>([]);
  readonly municipios = signal<Municipio[]>([]);
  readonly municipiosPorId = computed(() => new Map(this.municipios().map((m) => [m.id, m])));
  readonly cargado = signal(false);
  private pedido = false;

  /** Idiomas con el español primero. */
  readonly idiomasOrdenados = computed(() => [...this.idiomas()].sort((a, b) => (a.codigo === 'es' ? -1 : b.codigo === 'es' ? 1 : a.nombre.localeCompare(b.nombre))));

  cargar(): void {
    if (this.pedido) return;
    this.pedido = true;
    this.api.idiomas().subscribe({ next: (l) => l.length && this.idiomas.set(l), error: () => undefined });
    this.api.regiones().subscribe({
      next: (rs) => {
        this.regiones.set(rs);
        if (!rs.length) { this.cargado.set(true); return; }
        forkJoin(rs.map((r) => this.api.municipiosDeRegion(r.id).pipe(catchError(() => of([] as Municipio[]))))).subscribe((listas) => {
          this.municipios.set(listas.flat().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
          this.cargado.set(true);
        });
      },
      error: () => { this.pedido = false; this.cargado.set(true); },
    });
  }

  /** Vuelve a pedir los municipios (después de crear o editar uno). */
  recargarMunicipios(): void {
    this.api.regiones().subscribe({
      next: (rs) => {
        this.regiones.set(rs);
        if (!rs.length) return;
        forkJoin(rs.map((r) => this.api.municipiosDeRegion(r.id).pipe(catchError(() => of([] as Municipio[]))))).subscribe((l) => this.municipios.set(l.flat().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))));
      },
      error: () => undefined,
    });
  }

  nombreMunicipio(id: string | null | undefined): string {
    return id ? this.municipiosPorId().get(id)?.nombre ?? '' : '';
  }
}
