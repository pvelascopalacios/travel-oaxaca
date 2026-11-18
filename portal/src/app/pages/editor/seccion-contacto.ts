import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concat, last, Observable } from 'rxjs';
import { Api } from '../../core/api';
import { FilaContacto, TIPOS_CONTACTO, agruparPor, errorDeContacto, esTelefono, normalizarTelefono, planDeContactos } from '../../core/edicion';
import { Envio } from '../../core/envio';
import { Ficha, Idioma, IdiomaNivel, Respuesta, ResultadoCambio, Servicio } from '../../core/modelos';
import { leerError } from '../../core/portal';
import { EstadoGuardado } from '../../shared/estado-guardado';

const MAX_CONTACTOS = 30;
const MAX_IDIOMAS = 10;

/** Contacto (WhatsApp, teléfono, redes…), servicios que ofrece e idiomas que atiende; cada bloque se guarda por separado. */
@Component({
  selector: 'app-seccion-contacto',
  imports: [FormsModule, EstadoGuardado],
  templateUrl: './seccion-contacto.html',
  styleUrl: './seccion-contacto.scss',
})
export class SeccionContacto {
  private readonly api = inject(Api);
  readonly ficha = input.required<Ficha>();
  readonly servicios = input.required<Servicio[]>();
  readonly idiomas = input.required<Idioma[]>();
  readonly soloLectura = input(false);
  readonly guardado = output<ResultadoCambio>();

  protected readonly envioContactos = new Envio();
  protected readonly envioServicios = new Envio();
  protected readonly envioIdiomas = new Envio();

  protected readonly tipos = TIPOS_CONTACTO;
  protected readonly filas = signal<FilaContacto[]>([]);
  protected readonly erroresFila = signal<Record<number, string>>({});
  protected readonly elegidos = signal<Set<string>>(new Set());
  protected readonly niveles = signal<IdiomaNivel[]>([]);
  protected readonly nuevoIdioma = signal('');

  protected readonly grupos = computed(() => agruparPor(this.servicios()));
  protected readonly disponibles = computed(() => this.idiomas().filter((i) => !this.niveles().some((n) => n.idiomaCodigo === i.codigo)));
  protected readonly maxContactos = MAX_CONTACTOS;
  protected readonly maxIdiomas = MAX_IDIOMAS;
  protected readonly esTelefono = esTelefono;

  constructor() {
    // Cada bloque se llena cuando llega la ficha. Los guardados por separado vuelven a llenar solo lo suyo (ver abajo).
    effect(() => {
      const f = this.ficha();
      this.llenarContactos(f);
      this.elegidos.set(new Set(f.servicioIds ?? []));
      this.niveles.set((f.idiomas ?? []).map((i) => ({ ...i })));
    });
  }

  private llenarContactos(f: Ficha): void {
    this.filas.set((f.contactos ?? []).map((c) => ({ id: c.id, tipo: c.tipo, valor: c.valor, esPrincipal: c.esPrincipal })));
    this.erroresFila.set({});
  }

  protected nombreIdioma(codigo: string): string {
    return this.idiomas().find((i) => i.codigo === codigo)?.nombre ?? codigo;
  }

  protected ejemplo(tipo: string): string {
    return this.tipos.find((t) => t.valor === tipo)?.ejemplo ?? '';
  }

  // ---------- contactos ----------
  protected agregarContacto(): void {
    if (this.filas().length >= MAX_CONTACTOS) return;
    this.filas.update((l) => [...l, { id: null, tipo: 'whatsapp', valor: '', esPrincipal: !l.some((x) => x.tipo === 'whatsapp') }]);
  }

  protected quitarContacto(i: number): void {
    this.filas.update((l) => l.filter((_, j) => j !== i));
    this.erroresFila.set({});
  }

  protected cambiarFila(i: number, cambio: Partial<FilaContacto>): void {
    this.filas.update((l) => l.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  /** Un teléfono escrito «951 123 4567» se acomoda a «+529511234567» al salir del campo. */
  protected acomodar(i: number): void {
    const f = this.filas()[i];
    if (f && esTelefono(f.tipo)) this.cambiarFila(i, { valor: normalizarTelefono(f.valor) });
  }

  protected guardarContactos(): void {
    if (this.envioContactos.trabajando()) return;
    this.envioContactos.limpiar();
    const filas = this.filas().map((f) => ({ ...f, valor: esTelefono(f.tipo) ? normalizarTelefono(f.valor) : f.valor.trim() }));
    const errores: Record<number, string> = {};
    filas.forEach((f, i) => {
      const e = errorDeContacto(f.tipo, f.valor);
      if (e) errores[i] = e;
    });
    this.erroresFila.set(errores);
    if (Object.keys(errores).length) {
      this.envioContactos.fallar('Revisa los contactos marcados.');
      return;
    }
    const plan = planDeContactos(this.ficha().contactos ?? [], filas);
    const id = this.ficha().id;
    const pasos: Observable<Respuesta<ResultadoCambio>>[] = [
      ...plan.quitar.map((cid) => this.api.eliminarContacto(id, cid)),
      ...plan.cambiar.map((f) => this.api.actualizarContacto(id, f.id!, { tipo: f.tipo, valor: f.valor, esPrincipal: f.esPrincipal })),
      ...plan.crear.map((f) => this.api.crearContacto(id, { tipo: f.tipo, valor: f.valor, esPrincipal: f.esPrincipal })),
    ];
    if (!pasos.length) {
      this.envioContactos.resultado.set('ok');
      return;
    }
    this.envioContactos.trabajando.set(true);
    // Uno por uno: si alguno falla se detiene, se muestra lo que dijo la API y se recarga lo que sí quedó guardado.
    concat(...pasos).pipe(last()).subscribe({
      next: (r) => {
        this.envioContactos.trabajando.set(false);
        this.envioContactos.marcar(r.datos);
        this.llenarContactos(r.datos.ficha);
        this.guardado.emit(r.datos);
      },
      error: (e) => {
        this.envioContactos.trabajando.set(false);
        this.envioContactos.error.set(leerError(e));
        this.api.ficha(id).subscribe({
          next: (f) => this.guardado.emit({ aplicado: true, pendienteDeRevision: false, ficha: f }),
          error: () => undefined,
        });
      },
    });
  }

  // ---------- servicios ----------
  protected alternarServicio(id: string): void {
    this.elegidos.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected guardarServicios(): void {
    this.envioServicios.ejecutar(this.api.guardarServicios(this.ficha().id, [...this.elegidos()]), (r) => this.guardado.emit(r));
  }

  // ---------- idiomas ----------
  protected agregarIdioma(): void {
    const codigo = this.nuevoIdioma();
    if (!codigo || this.niveles().length >= MAX_IDIOMAS) return;
    this.niveles.update((l) => [...l, { idiomaCodigo: codigo, nivel: 'basico' }]);
    this.nuevoIdioma.set('');
  }

  protected nivel(codigo: string, nivel: 'basico' | 'fluido'): void {
    this.niveles.update((l) => l.map((x) => (x.idiomaCodigo === codigo ? { ...x, nivel } : x)));
  }

  protected quitarIdioma(codigo: string): void {
    this.niveles.update((l) => l.filter((x) => x.idiomaCodigo !== codigo));
  }

  protected guardarIdiomas(): void {
    this.envioIdiomas.ejecutar(this.api.guardarIdiomas(this.ficha().id, this.niveles()), (r) => this.guardado.emit(r));
  }
}
