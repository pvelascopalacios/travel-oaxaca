import { Component, ViewEncapsulation, effect, HostListener, inject, OnDestroy } from '@angular/core';
import { Avisos, DURACION_OK, Aviso } from '../core/avisos';

/** Avisos flotantes, abajo a la derecha (no tapan el botón Guardar, que va a la izquierda); en celular, arriba de la barra inferior. */
@Component({
  selector: 'app-avisos',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="avisos-f" role="region" aria-label="Avisos">
      @for (a of avisos.lista(); track a.id) {
        <div class="aviso-f" [class]="'aviso-f ' + a.tipo" [attr.role]="a.tipo === 'error' ? 'alert' : 'status'" (mouseenter)="detener(a)" (mouseleave)="iniciar(a)" (focusin)="detener(a)" (focusout)="iniciar(a)">
          <span class="aviso-f-ico" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              @if (a.tipo === 'ok') { <path d="M5 12l4 4 10-10" /> } @else { <path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /> }
            </svg>
          </span>
          <span class="aviso-f-txt">{{ a.texto }}</span>
          @if (a.accion; as ac) { <button type="button" class="aviso-f-btn" (click)="accionar(a, ac.hacer)">{{ ac.texto }}</button> }
          <button type="button" class="aviso-f-x" aria-label="Cerrar aviso" (click)="avisos.cerrar(a.id)">✕</button>
          @if (a.tipo === 'ok') { <i class="aviso-f-barra" [style.animation-duration.ms]="duracion"></i> }
        </div>
      }
    </div>
  `,
  styles: `
    .avisos-f { position: fixed; z-index: 60; right: 24px; bottom: 20px; width: min(460px, calc(100vw - 32px)); display: grid; gap: 8px; pointer-events: none; }
    .aviso-f { pointer-events: auto; position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; border-radius: 14px; box-shadow: 0 10px 28px rgb(29 36 51 / 25%); animation: aviso-entra 0.16s ease-out; }
    .aviso-f.ok { background: var(--noche); color: #fff; }
    .aviso-f.ok .aviso-f-ico { color: #8fd16f; }
    .aviso-f.error { background: var(--rojo); color: var(--rojo-texto); border: 1.5px solid rgb(138 28 28 / 30%); }
    .aviso-f-ico { display: inline-flex; flex: none; }
    .aviso-f-txt { flex: 1; min-width: 0; font-weight: 600; font-size: 0.9rem; overflow-wrap: anywhere; }
    .aviso-f-btn { flex: none; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--rojo-texto); color: #fff; font: 700 0.82rem var(--fuente); cursor: pointer; }
    .aviso-f-x { flex: none; width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: inherit; opacity: 0.75; font-size: 0.95rem; cursor: pointer; }
    .aviso-f-x:hover { opacity: 1; background: rgb(255 255 255 / 12%); }
    .aviso-f.error .aviso-f-x:hover { background: rgb(138 28 28 / 12%); }
    .aviso-f-btn:focus-visible, .aviso-f-x:focus-visible { outline: 3px solid var(--ocre); outline-offset: 2px; }
    .aviso-f-barra { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: #8fd16f; transform-origin: left; animation: aviso-barra linear forwards; }
    .aviso-f:hover .aviso-f-barra, .aviso-f:focus-within .aviso-f-barra { animation-play-state: paused; }
    @keyframes aviso-barra { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @keyframes aviso-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (max-width: 800px) { .avisos-f { right: 16px; left: 16px; width: auto; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); } }
    @media (prefers-reduced-motion: reduce) { .aviso-f, .aviso-f-barra { animation: none; } .aviso-f-barra { display: none; } }
    @media print { .avisos-f { display: none; } }
  `,
})
export class AvisosFlotantes implements OnDestroy {
  protected readonly avisos = inject(Avisos);
  protected readonly duracion = DURACION_OK;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const ids = new Set(this.avisos.lista().map((a) => a.id));
      for (const a of this.avisos.lista()) if (a.tipo === 'ok' && !this.temporizadores.has(a.id)) this.iniciar(a);
      for (const id of [...this.temporizadores.keys()]) if (!ids.has(id)) this.detenerId(id);
    });
  }

  protected iniciar(a: Aviso): void {
    if (a.tipo !== 'ok') return;
    this.detenerId(a.id);
    this.temporizadores.set(a.id, setTimeout(() => { this.temporizadores.delete(a.id); this.avisos.cerrar(a.id); }, DURACION_OK));
  }

  protected detener(a: Aviso): void {
    this.detenerId(a.id);
  }

  private detenerId(id: number): void {
    const t = this.temporizadores.get(id);
    if (t) clearTimeout(t);
    this.temporizadores.delete(id);
  }

  protected accionar(a: Aviso, hacer: () => void): void {
    this.avisos.cerrar(a.id);
    hacer();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    if (this.avisos.lista().length > 0) this.avisos.cerrarUltimo();
  }

  ngOnDestroy(): void {
    for (const t of this.temporizadores.values()) clearTimeout(t);
  }
}
