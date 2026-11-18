import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Plantilla } from '../../core/modelos';
import { PLANTILLA_ASUNTO_MAX, PLANTILLA_CUERPO_MAX, errorDePlantilla } from '../../core/operacion';
import { ErrorApi, leerError } from '../../core/panel';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Textos de los correos y avisos. Solo administración. Cada plantilla solo admite sus propias variables. */
@Component({
  selector: 'app-plantillas',
  imports: [FormsModule],
  templateUrl: './plantillas.html',
  styleUrl: './plantillas.scss',
})
export class Plantillas implements OnInit {
  private readonly api = inject(Api);
  protected readonly asuntoMax = PLANTILLA_ASUNTO_MAX;
  protected readonly cuerpoMax = PLANTILLA_CUERPO_MAX;
  protected readonly lista = signal<Plantilla[] | null>(null);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly elegida = signal<Plantilla | null>(null);
  protected asunto = '';
  protected cuerpo = '';
  protected activa = true;
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly trabajando = signal(false);
  protected readonly probando = signal(false);

  ngOnInit(): void { this.cargar(); }

  protected cargar(): void {
    this.fallo.set(null);
    this.api.plantillas().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar las plantillas.')) });
  }

  protected abrir(p: Plantilla): void {
    this.elegida.set(p);
    this.asunto = p.asunto ?? '';
    this.cuerpo = p.cuerpo;
    this.activa = p.activa;
    this.errores.set({});
    this.errorApi.set(null);
    this.aviso.set(null);
  }

  protected get cambiada(): boolean {
    const p = this.elegida();
    return !!p && (this.asunto !== (p.asunto ?? '') || this.cuerpo !== p.cuerpo || this.activa !== p.activa);
  }

  protected insertar(v: string): void { this.cuerpo = `${this.cuerpo}{{${v}}}`; }

  protected guardar(): void {
    const p = this.elegida();
    if (!p || this.trabajando()) return;
    this.aviso.set(null);
    const e = errorDePlantilla(p, this.asunto, this.cuerpo);
    this.errores.set(e);
    if (Object.keys(e).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.errorApi.set(null);
    this.trabajando.set(true);
    this.api.editarPlantilla(p.id, { asunto: this.asunto.trim() || null, cuerpo: this.cuerpo.trim(), activa: this.activa }).subscribe({
      next: (r) => { this.trabajando.set(false); this.lista.update((l) => (l ?? []).map((x) => (x.id === p.id ? r.datos : x))); this.abrir(r.datos); this.aviso.set(r.mensajes?.[0] ?? 'Plantilla guardada.'); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.general); if (x.campos) this.errores.set(x.campos); },
    });
  }

  protected probar(): void {
    const p = this.elegida();
    if (!p || this.probando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    this.probando.set(true);
    this.api.probarPlantilla(p.id).subscribe({
      next: (r) => { this.probando.set(false); this.aviso.set(r.mensajes?.[0] ?? 'Listo: te enviamos un correo de prueba con valores de ejemplo (revisa la cola de notificaciones).'); },
      error: (e) => { this.probando.set(false); this.errorApi.set(leerError(e).general); },
    });
  }
}
