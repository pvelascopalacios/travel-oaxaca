import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Api } from '../core/api';
import { Sesion } from '../core/sesion';

interface Enlace {
  texto: string;
  ruta: string | null;
  pronto?: boolean;
  exacto?: boolean;
  /** Otra ruta que también deja este enlace marcado. */
  tambien?: string;
}

/** Marco del portal: menú lateral en pantallas grandes y barra deslizable arriba en el celular. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly api = inject(Api);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  /** Id del negocio que se está viendo, si lo hay. */
  protected readonly negocioId = computed(() => /^\/negocios\/([0-9a-f-]{36})/i.exec(this.url())?.[1] ?? null);

  protected readonly enlaces = computed<Enlace[]>(() => {
    const id = this.negocioId();
    const base: Enlace[] = [{ texto: 'Mis negocios', ruta: '/negocios', exacto: true }];
    if (!id) return base;
    return [
      { texto: 'Resumen', ruta: `/negocios/${id}`, exacto: true },
      { texto: 'Ficha', ruta: `/negocios/${id}/ficha` },
      { texto: 'Fotos y ofertas', ruta: `/negocios/${id}/fotos`, tambien: `/negocios/${id}/opciones` },
      { texto: 'Promociones', ruta: `/negocios/${id}/promociones` },
      { texto: 'Plan y pagos', ruta: `/negocios/${id}/plan` },
      { texto: 'Equipo', ruta: `/negocios/${id}/equipo` },
      { texto: 'Reporte mensual', ruta: `/negocios/${id}/reporte`, exacto: true },
    ];
  });

  /** ¿Este enlace es el de la pantalla actual? Los de dos rutas (fotos y opciones) quedan marcados en las dos. */
  protected esActivo(e: Enlace): boolean {
    if (!e.ruta) return false;
    const ruta = this.url().split('?')[0];
    return e.exacto ? ruta === e.ruta : ruta === e.ruta || ruta.startsWith(e.ruta + '/') || ruta === e.tambien;
  }

  protected salir(): void {
    const t = this.sesion.tokenRenovacion();
    if (t) this.api.salir(t).subscribe({ error: () => undefined });
    this.sesion.cerrarLocal();
    void this.router.navigate(['/ingresar']);
  }
}
