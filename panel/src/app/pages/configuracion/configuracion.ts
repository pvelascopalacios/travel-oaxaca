import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Configuracion } from '../../core/modelos';
import { agruparConfig, esSensible, rangoTexto, valorComoTexto, valorParaApi } from '../../core/operacion';
import { ErrorApi, fechaCorta, leerError } from '../../core/panel';
import { enlazarAviso } from '../../core/avisos';

/** Valores que ajustan el comportamiento de la API. Solo administración; solo se cambian valores, no se crean claves. */
@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class ConfiguracionPagina implements OnInit {
  private readonly api = inject(Api);
  protected readonly lista = signal<Configuracion[] | null>(null);
  protected readonly grupos = computed(() => agruparConfig(this.lista() ?? []));
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected valores: Record<string, string> = {};
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly guardando = signal<string | null>(null);
  protected readonly confirmando = signal<string | null>(null);
  protected readonly rango = rangoTexto;
  protected readonly sensible = esSensible;
  protected readonly fecha = fechaCorta;

  ngOnInit(): void { this.cargar(); }

  protected cargar(): void {
    this.fallo.set(null);
    this.api.configuracion().subscribe({
      next: (l) => { this.lista.set(l); this.valores = Object.fromEntries(l.map((c) => [c.clave, valorComoTexto(c)])); },
      error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar la configuración.')),
    });
  }

  protected cambiado(c: Configuracion): boolean {
    const a = valorComoTexto(c);
    return c.tipo === 'json' || c.tipo === 'objeto' || (c.tipo !== 'texto' && c.tipo !== 'entero' && c.tipo !== 'booleano')
      ? this.valores[c.clave]?.replace(/\s/g, '') !== a.replace(/\s/g, '')
      : this.valores[c.clave] !== a;
  }

  protected esBooleano = (c: Configuracion): boolean => c.tipo === 'booleano';
  protected esLargo = (c: Configuracion): boolean => c.tipo !== 'texto' && c.tipo !== 'entero' && c.tipo !== 'booleano';

  /** Booleano: un clic cambia el valor; los sensibles piden confirmar antes de enviar. */
  protected alternar(c: Configuracion): void {
    this.valores[c.clave] = this.valores[c.clave] === 'true' ? 'false' : 'true';
    this.quitarError(c.clave);
    if (esSensible(c.clave)) this.confirmando.set(c.clave);
    else this.guardar(c);
  }

  protected pedir(c: Configuracion): void {
    const r = valorParaApi(c, this.valores[c.clave] ?? '');
    if ('error' in r) { this.errores.update((e) => ({ ...e, [c.clave]: r.error })); return; }
    if (esSensible(c.clave)) this.confirmando.set(c.clave);
    else this.guardar(c);
  }

  protected descartar(c: Configuracion): void {
    this.valores[c.clave] = valorComoTexto(c);
    this.confirmando.set(null);
    this.quitarError(c.clave);
  }

  protected guardar(c: Configuracion): void {
    if (this.guardando()) return;
    const r = valorParaApi(c, this.valores[c.clave] ?? '');
    if ('error' in r) { this.errores.update((e) => ({ ...e, [c.clave]: r.error })); return; }
    this.aviso.set(null);
    this.guardando.set(c.clave);
    this.api.cambiarConfiguracion(c.clave, r.valor).subscribe({
      next: (resp) => {
        this.guardando.set(null);
        this.confirmando.set(null);
        this.lista.update((l) => (l ?? []).map((x) => (x.clave === c.clave ? resp.datos : x)));
        this.valores[c.clave] = valorComoTexto(resp.datos);
        this.aviso.set(`«${c.clave}» actualizada.`);
      },
      error: (e) => {
        this.guardando.set(null);
        this.confirmando.set(null);
        const x = leerError(e);
        this.errores.update((m) => ({ ...m, [c.clave]: x.campos?.['valor'] ?? x.general ?? 'No pudimos guardar el valor.' }));
      },
    });
  }

  private quitarError(k: string): void { this.errores.update((e) => { const { [k]: _, ...resto } = e; return resto; }); }
  protected quitar(k: string): void { this.quitarError(k); }
}
