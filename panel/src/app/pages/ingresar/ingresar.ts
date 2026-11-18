import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, destinoSeguro, leerError } from '../../core/panel';
import { Sesion } from '../../core/sesion';

/** Ingreso del equipo. Las cuentas se crean desde el registro del portal; aquí solo se entra. */
@Component({
  selector: 'app-ingresar',
  imports: [FormsModule],
  templateUrl: './ingresar.html',
  styleUrl: './ingresar.scss',
})
export class Ingresar {
  private readonly api = inject(Api);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);

  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected correo = '';
  protected clave = '';
  private readonly volver = destinoSeguro(this.ruta.snapshot.queryParamMap.get('volver'));

  constructor() {
    effect(() => {
      if (this.sesion.autenticado()) void this.router.navigateByUrl(this.volver ?? '/');
    });
  }

  protected campo(n: string): string | null {
    return this.error().campos[n] ?? null;
  }

  protected enviar(): void {
    if (this.enviando()) return;
    const campos: Record<string, string> = {};
    if (!this.correo.trim()) campos['correo'] = 'Escribe tu correo.';
    if (!this.clave) campos['clave'] = 'Escribe tu contraseña.';
    if (Object.keys(campos).length) {
      this.error.set({ general: null, campos });
      return;
    }
    this.enviando.set(true);
    this.error.set({ general: null, campos: {} });
    this.api.ingreso({ correo: this.correo.trim(), clave: this.clave }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.sesion.iniciar(r.datos);
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(leerError(e));
      },
    });
  }
}
