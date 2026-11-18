import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Auditoria, UsuarioAdmin } from '../../core/modelos';
import { ACCIONES_AUDITORIA, accionAuditoria, diferencias } from '../../core/operacion';
import { ErrorApi, fechaHora, leerError } from '../../core/panel';
import { haceDias, hoyISO } from '../../core/ventas';
import { VacioEstado } from '../../shared/vacio';

/** Registro de quién cambió qué (solo lectura, solo administración). */
@Component({
  selector: 'app-auditoria',
  imports: [FormsModule, VacioEstado],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
})
export class AuditoriaPagina implements OnInit {
  private readonly api = inject(Api);
  protected readonly acciones = ACCIONES_AUDITORIA;
  protected readonly accionInfo = accionAuditoria;
  protected readonly cuando = fechaHora;
  protected tabla = '';
  protected accion = '';
  protected usuarioId = '';
  protected registroId = '';
  protected desde = haceDias(7);
  protected hasta = hoyISO();
  protected readonly pagina = signal(0);
  protected readonly datos = signal<{ elementos: Auditoria[]; total: number; tamano: number } | null>(null);
  protected readonly usuarios = signal<UsuarioAdmin[]>([]);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly abierto = signal<number | null>(null);
  protected readonly paginas = computed(() => { const d = this.datos(); return d ? Math.max(1, Math.ceil(d.total / d.tamano)) : 1; });
  protected readonly dif = diferencias;

  ngOnInit(): void {
    this.api.usuarios({ tamano: 100 }).subscribe({ next: (p) => this.usuarios.set(p.elementos), error: () => undefined });
    this.cargar();
  }

  protected filtrar(): void { this.pagina.set(0); this.cargar(); }
  protected hayFiltros(): boolean { return !!(this.tabla || this.accion || this.usuarioId || this.registroId || this.desde || this.hasta); }
  protected limpiar(): void { this.tabla = ''; this.accion = ''; this.usuarioId = ''; this.registroId = ''; this.desde = ''; this.hasta = ''; this.filtrar(); }
  protected ir(p: number): void { this.pagina.set(p); this.cargar(); }

  protected cargar(): void {
    this.fallo.set(null);
    if (this.desde && this.hasta && this.desde > this.hasta) { this.fallo.set({ general: 'La fecha inicial debe ser anterior o igual a la final.', campos: {} }); return; }
    this.abierto.set(null);
    this.api.auditoria({ tabla: this.tabla, accion: this.accion, usuarioId: this.usuarioId, registroId: this.registroId, desde: this.desde, hasta: this.hasta, pagina: this.pagina() }).subscribe({
      next: (p) => this.datos.set({ elementos: p.elementos, total: p.total, tamano: p.tamano }),
      error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar la auditoría.')),
    });
  }

  protected alternar(id: number): void { this.abierto.set(this.abierto() === id ? null : id); }
}
