import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Campana, Origen } from '../../core/modelos';
import { FormCampana, campanaParaApi, enlaceCampana, errorDeCampana, formCampanaVacio, formDeCampana } from '../../core/operacion';
import { ErrorApi, fechaCorta, leerError } from '../../core/panel';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Campañas de origen de tráfico (admin y edición). El código va en los enlaces (?o=codigo) y no se cambia. */
@Component({
  selector: 'app-campanas',
  imports: [FormsModule],
  templateUrl: './campanas.html',
  styleUrl: './campanas.scss',
})
export class Campanas implements OnInit {
  private readonly api = inject(Api);
  protected readonly fecha = fechaCorta;
  /** Dirección pública del sitio, para armar el enlace de ejemplo. */
  protected readonly sitio = signal(typeof location !== 'undefined' ? location.origin.replace(/:4400$/, ':4200') : '');
  protected readonly lista = signal<Campana[] | null>(null);
  protected readonly origenes = signal<Origen[]>([]);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly editando = signal<string | null>(null);
  protected form: FormCampana = formCampanaVacio();
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly trabajando = signal(false);
  protected readonly copiado = signal<string | null>(null);
  protected enlace = (c: string): string => enlaceCampana(this.sitio(), c);

  ngOnInit(): void {
    this.api.origenes().subscribe({ next: (o) => this.origenes.set(o), error: () => undefined });
    this.cargar();
  }

  protected cargar(): void {
    this.fallo.set(null);
    this.api.campanas().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.fallo.set(leerError(e, 'No pudimos cargar las campañas.')) });
  }

  protected nueva(): void { this.abrir('nueva', formCampanaVacio()); }
  protected editar(c: Campana): void { this.abrir(c.id, formDeCampana(c)); }
  private abrir(id: string, f: FormCampana): void {
    this.aviso.set(null);
    this.form = f;
    this.errores.set({});
    this.errorApi.set(null);
    this.editando.set(id);
  }

  protected guardar(): void {
    const id = this.editando();
    if (!id || this.trabajando()) return;
    const nueva = id === 'nueva';
    const e = errorDeCampana(this.form, nueva);
    this.errores.set(e);
    if (Object.keys(e).length) { this.errorApi.set('Revisa los campos marcados.'); return; }
    this.errorApi.set(null);
    this.trabajando.set(true);
    const cuerpo = campanaParaApi(this.form, nueva);
    (nueva ? this.api.crearCampana(cuerpo) : this.api.actualizarCampana(id, cuerpo)).subscribe({
      next: (r) => { this.trabajando.set(false); this.editando.set(null); this.aviso.set(r.mensajes?.[0] ?? 'Campaña guardada.'); this.cargar(); },
      error: (er) => { this.trabajando.set(false); const x = leerError(er); this.errorApi.set(x.general); if (x.campos) this.errores.set(x.campos); },
    });
  }

  protected copiar(codigo: string): void {
    const t = this.enlace(codigo);
    const listo = () => { this.copiado.set(codigo); setTimeout(() => this.copiado.set(null), 2000); };
    navigator.clipboard?.writeText(t).then(listo, () => undefined);
  }
}
