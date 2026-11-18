import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LimiteMotivo, errorDeMotivo } from '../core/panel';

/** Cuadro para escribir el motivo de un rechazo. Valida el largo antes de enviarlo a la API. */
@Component({
  selector: 'app-rechazo',
  imports: [FormsModule],
  template: `
    <form class="rechazo" (ngSubmit)="enviar()" novalidate>
      <label [class.error]="error()">{{ titulo() }} <span class="ayuda">({{ ayuda() }})</span>
        <textarea name="motivo" rows="3" [maxlength]="limite().max + 50" [placeholder]="ejemplo()" [ngModel]="motivo()" (ngModelChange)="cambiar($event)"></textarea>
        <span class="contador">{{ motivo().trim().length }} / {{ limite().max }}</span>
        @if (error(); as m) { <span class="msg">{{ m }}</span> }
      </label>
      @if (errorApi(); as e) { <p class="aviso" role="alert">{{ e }}</p> }
      <div class="fila">
        <button type="submit" class="mini-b mal" [disabled]="trabajando()">{{ trabajando() ? 'Enviando…' : 'Enviar rechazo' }}</button>
        <button type="button" class="mini-b" [disabled]="trabajando()" (click)="cancelar.emit()">Cancelar</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }
    .rechazo { display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: var(--aviso); }
    .fila { display: flex; gap: 8px; flex-wrap: wrap; }
    .mini-b { min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1.5px solid var(--linea); background: var(--papel); color: var(--tinta); font: 600 0.86rem var(--fuente); cursor: pointer; }
    .mini-b.mal { color: var(--grana); border-color: var(--grana); }
    .mini-b:disabled { opacity: 0.45; cursor: not-allowed; }
  `,
})
export class Rechazo {
  readonly limite = input.required<LimiteMotivo>();
  readonly titulo = input('Motivo del rechazo');
  readonly ejemplo = input('Ej. Explica qué debe corregir para volver a enviarlo.');
  readonly trabajando = input(false);
  readonly errorApi = input<string | null>(null);
  readonly confirmar = output<string>();
  readonly cancelar = output<void>();

  protected readonly motivo = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly ayuda = computed(() => (this.limite().min > 1 ? `de ${this.limite().min} a ${this.limite().max} caracteres` : `hasta ${this.limite().max} caracteres`));

  protected cambiar(v: string): void {
    this.motivo.set(v);
    if (this.error()) this.error.set(errorDeMotivo(v, this.limite()));
  }

  protected enviar(): void {
    if (this.trabajando()) return;
    const e = errorDeMotivo(this.motivo(), this.limite());
    this.error.set(e);
    if (!e) this.confirmar.emit(this.motivo().trim());
  }
}
