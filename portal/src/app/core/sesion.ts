import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { API_URL } from './config';
import { Respuesta, RespuestaSesion, Tokens, Usuario } from './modelos';

const LLAVE = 'to_portal_sesion';

interface Guardado {
  tokenRenovacion: string;
  usuario: Usuario;
}

/**
 * Sesión de la persona. El token de acceso vive solo en memoria; el de renovación y los datos básicos se guardan
 * en el navegador para no pedir la contraseña en cada visita. El portal no tiene servidor: se restaura al arrancar.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  // Sin interceptores: renovar la sesión no puede depender de tener sesión.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = inject(API_URL);

  readonly usuario = signal<Usuario | null>(null);
  readonly autenticado = computed(() => this.usuario() !== null);
  readonly primerNombre = computed(() => (this.usuario()?.nombre ?? '').trim().split(/\s+/)[0] ?? '');

  private acceso: string | null = null;
  private expira = 0;
  private renovacion: string | null = null;
  private renovando: Promise<string | null> | null = null;

  constructor() {
    try {
      const crudo = localStorage.getItem(LLAVE);
      if (crudo) {
        const g = JSON.parse(crudo) as Guardado;
        if (g?.tokenRenovacion && g.usuario?.id) {
          this.renovacion = g.tokenRenovacion;
          this.usuario.set(g.usuario);
        }
      }
    } catch {
      /* almacenamiento bloqueado o dañado: se empieza sin sesión */
    }
  }

  iniciar(r: RespuestaSesion): void {
    this.fijarTokens(r);
    this.usuario.set(r.usuario);
    this.guardar();
  }

  cerrarLocal(): void {
    this.acceso = null;
    this.expira = 0;
    this.renovacion = null;
    this.usuario.set(null);
    try {
      localStorage.removeItem(LLAVE);
    } catch {
      /* ignorar */
    }
  }

  tokenRenovacion(): string | null {
    return this.renovacion;
  }

  /** Token de acceso vigente; si venció o falta, lo renueva. Sin sesión regresa null. */
  async token(): Promise<string | null> {
    if (!this.usuario()) return null;
    if (this.acceso && Date.now() < this.expira - 30_000) return this.acceso;
    if (!this.renovacion) return null;
    this.renovando ??= this.renovar().finally(() => (this.renovando = null));
    return this.renovando;
  }

  private async renovar(): Promise<string | null> {
    try {
      const r = await firstValueFrom(
        this.http.post<Respuesta<Tokens>>(this.base + '/auth/renovar', { tokenRenovacion: this.renovacion }).pipe(timeout(8000)),
      );
      this.fijarTokens(r.datos);
      this.guardar();
      return this.acceso;
    } catch {
      this.cerrarLocal();
      return null;
    }
  }

  private fijarTokens(t: Tokens): void {
    this.acceso = t.tokenAcceso;
    this.expira = Date.now() + t.expiraEnSegundos * 1000;
    this.renovacion = t.tokenRenovacion;
  }

  private guardar(): void {
    const u = this.usuario();
    if (!u || !this.renovacion) return;
    try {
      localStorage.setItem(LLAVE, JSON.stringify({ tokenRenovacion: this.renovacion, usuario: u } satisfies Guardado));
    } catch {
      /* ignorar */
    }
  }
}
