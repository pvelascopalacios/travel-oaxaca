import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Sesion } from '../../core/sesion';

/** Alguien con cuenta pero sin rol del equipo (por ejemplo, el dueño de un negocio) llega aquí. */
@Component({
  selector: 'app-sin-acceso',
  template: `
    <div class="pagina">
      <div class="caja">
        <div class="marca"><img src="logo-emblema.png" alt="" width="40" height="40" /><span>Travel Oaxaca<small>Panel de administración</small></span></div>
        <h1>Esta cuenta no tiene acceso al panel</h1>
        <p class="suave">El panel es solo para el equipo de Travel Oaxaca. Si eres dueño de un negocio, administra tu ficha desde el Portal del negocio.</p>
        <button type="button" class="boton" (click)="salir()">Cerrar sesión</button>
      </div>
    </div>
  `,
  styles: `
    .pagina { min-height: 100vh; display: grid; place-items: start center; padding: 32px max(16px, env(safe-area-inset-right, 0px)) 48px max(16px, env(safe-area-inset-left, 0px)); }
    .caja { width: 100%; max-width: 440px; background: var(--papel); border-radius: 18px; box-shadow: var(--sombra); padding: 28px; display: grid; gap: 16px; justify-items: start; }
    .marca { display: flex; align-items: center; gap: 10px; font: 800 1.05rem var(--fuente-titulo); }
    .marca small { display: block; font: 400 0.74rem var(--fuente); color: var(--suave); }
    h1 { margin: 0; font-size: 1.4rem; }
    p { margin: 0; }
  `,
})
export class SinAcceso {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  protected salir(): void {
    this.sesion.cerrarLocal();
    void this.router.navigate(['/ingresar']);
  }
}
