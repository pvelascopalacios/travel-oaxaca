import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { catchError, of, timeout } from 'rxjs';
import { API_URL } from './config';

export type TipoUso = 'vista_ficha' | 'toque_whatsapp' | 'llamada' | 'como_llegar' | 'compartido' | 'clic_web';

const LLAVE = 'to_dispositivo';

/**
 * Cuenta lo que hace el turista en la ficha (sin cuenta, sin datos personales). Solo corre en el navegador
 * y nunca estorba: si algo falla, se ignora. El dispositivo se registra una vez y se guarda su id.
 */
@Injectable({ providedIn: 'root' })
export class Medicion {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private dispositivo: Promise<string | null> | null = null;

  registrar(tipo: TipoUso, negocioId: string, sucursalId?: string | null): void {
    if (!this.navegador) return;
    void this.dispositivoId().then((dispositivoId) => {
      if (!dispositivoId) return;
      const origen = new URLSearchParams(location.search).get('o')?.slice(0, 40) || 'web';
      this.http
        .post(this.base + '/publico/eventos-uso', { dispositivoId, origen, eventos: [{ tipo, negocioId, sucursalId: sucursalId ?? null }] })
        .pipe(timeout(5000), catchError(() => of(null)))
        .subscribe();
    });
  }

  /** Id del dispositivo web; null si todavía no se pudo registrar. */
  dispositivoId(): Promise<string | null> {
    this.dispositivo ??= this.obtener();
    return this.dispositivo;
  }

  private async obtener(): Promise<string | null> {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(LLAVE);
    } catch {
      /* sin almacenamiento: se registra en cada visita */
    }
    if (guardado) return guardado;
    try {
      const r = await new Promise<{ datos?: { dispositivoId?: string } } | null>((resolve) => {
        this.http
          .post<{ datos?: { dispositivoId?: string } }>(this.base + '/publico/dispositivos', { plataforma: 'web', idiomaCodigo: document.documentElement.lang || 'es' })
          .pipe(timeout(5000), catchError(() => of(null)))
          .subscribe((x) => resolve(x));
      });
      const nuevo = r?.datos?.dispositivoId ?? null;
      if (nuevo) {
        try {
          localStorage.setItem(LLAVE, nuevo);
        } catch {
          /* ignorar */
        }
      }
      return nuevo;
    } catch {
      return null;
    }
  }
}
