import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, shareReplay } from 'rxjs';
import { Api } from './api';
import { I18n } from './i18n';
import { Categoria, Facetas, Servicio } from './modelos';

export interface DatosCatalogo {
  arbol: Categoria[];
  servicios: Servicio[];
  facetas: Facetas;
}

/** Categorías, servicios y conteos para los chips. Cambian poco, así que se piden una vez por idioma. */
@Injectable({ providedIn: 'root' })
export class Catalogo {
  private readonly api = inject(Api);
  private readonly i18n = inject(I18n);
  private readonly guardado = new Map<string, Observable<DatosCatalogo>>();

  datos(): Observable<DatosCatalogo> {
    const idioma = this.i18n.lang();
    let o = this.guardado.get(idioma);
    if (!o) {
      o = forkJoin({ arbol: this.api.categorias(), servicios: this.api.servicios(), facetas: this.api.facetas() }).pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.guardado.set(idioma, o);
    }
    return o;
  }
}
