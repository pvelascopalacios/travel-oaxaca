import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription, last, map, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { Envio } from '../../core/envio';
import { cupoFotos, enOrden, errorDeArchivo, hayCambiosDeOrden, mover, moderacionInfo, pesoTexto, portadaDe, TIPOS_FOTO } from '../../core/fotos';
import { Categoria, Ficha, MedioFicha, PlanNegocio } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/portal';
import { raizDeCategoria } from '../../core/edicion';
import { CabeceraOpciones } from '../../shared/cabecera-opciones';
import { EstadoGuardado } from '../../shared/estado-guardado';

type PasoArchivo = 'lista' | 'pidiendo' | 'subiendo' | 'confirmando' | 'agregando' | 'error';

interface Archivo {
  clave: number;
  archivo: File;
  /** Vista previa local (se libera al quitar la foto de la lista). */
  vista: string;
  pie: string;
  paso: PasoArchivo;
  progreso: number;
  error: string | null;
}

/** Fotos del negocio: subir (URL firmada → almacén → confirmar → ligar), ordenar, elegir portada y quitar. */
@Component({
  selector: 'app-fotos',
  imports: [CabeceraOpciones, EstadoGuardado],
  templateUrl: './fotos.html',
  styleUrl: './fotos.scss',
})
export class Fotos implements OnInit {
  /** Viene de la dirección: /negocios/:id/fotos */
  readonly id = input.required<string>();
  private readonly api = inject(Api);

  protected readonly aceptar = TIPOS_FOTO.join(',');
  protected readonly pesoTexto = pesoTexto;
  protected readonly moderacion = moderacionInfo;

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly plan = signal<PlanNegocio | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);

  // orden y portada que se están viendo (pueden diferir de lo guardado hasta pulsar «Guardar»)
  protected readonly orden = signal<string[]>([]);
  protected readonly portada = signal<string | null>(null);
  private readonly tocado = signal(false);

  protected readonly envioOrden = new Envio();
  protected readonly envioQuitar = new Envio();
  protected readonly quitandoId = signal<string | null>(null);
  protected readonly rotas = signal<ReadonlySet<string>>(new Set());

  protected readonly cola = signal<Archivo[]>([]);
  protected readonly rechazados = signal<string[]>([]);
  protected readonly aviso = signal<string | null>(null);
  protected readonly arrastrando = signal(false);
  private clave = 0;
  private procesando = false;
  private readonly suscripciones = new Map<number, Subscription>();

  protected readonly medios = computed<MedioFicha[]>(() => {
    const por = new Map((this.ficha()?.medios ?? []).map((m) => [m.medioId, m]));
    return this.orden().map((i) => por.get(i)).filter((m): m is MedioFicha => !!m);
  });
  protected readonly raiz = computed(() => raizDeCategoria(this.arbol(), this.ficha()?.categoriaId ?? ''));
  protected readonly cupo = computed(() => cupoFotos(this.ficha()?.medios.length ?? 0, this.plan()));
  protected readonly enCola = computed(() => this.cola().length);
  protected readonly porcentaje = computed(() => Math.min(100, Math.round((100 * (this.ficha()?.medios.length ?? 0)) / Math.max(1, this.cupo().maximo))));
  protected readonly sucio = computed(() => hayCambiosDeOrden(this.orden(), this.portada(), this.ficha()?.medios ?? []));
  protected readonly listas = computed(() => this.cola().filter((a) => a.paso === 'lista').length);
  protected readonly ocupada = computed(() => this.cola().some((a) => ['pidiendo', 'subiendo', 'confirmando', 'agregando'].includes(a.paso)));
  /** En revisión o archivada no se editan las fotos (la API también lo rechaza). */
  protected readonly soloLectura = computed(() => ['en_revision', 'archivada'].includes(this.ficha()?.estado ?? ''));
  protected readonly puedeSubir = computed(() => !this.soloLectura() && this.cupo().restante - this.enCola() > 0);

  constructor() {
    // Cada vez que cambia la ficha se actualiza el orden que se ve; si hay cambios sin guardar se respetan.
    effect(() => {
      const f = this.ficha();
      if (!f) return;
      const guardadas = enOrden(f.medios).map((m) => m.medioId);
      const actual = untracked(this.orden);
      if (untracked(this.tocado)) {
        const quedan = actual.filter((i) => guardadas.includes(i));
        this.orden.set([...quedan, ...guardadas.filter((i) => !quedan.includes(i))]);
        if (!guardadas.includes(untracked(this.portada) ?? '')) this.portada.set(portadaDe(f.medios));
      } else {
        this.orden.set(guardadas);
        this.portada.set(portadaDe(f.medios));
      }
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.ficha(this.id()).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar tu negocio. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
    // El plan y las categorías son de apoyo: si fallan, la página sigue y la API decide al final.
    this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  // ---------------- elegir archivos ----------------

  protected alElegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.agregarArchivos(Array.from(input.files ?? []));
    input.value = '';
  }

  protected alSoltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
    if (this.puedeSubir()) this.agregarArchivos(Array.from(ev.dataTransfer?.files ?? []));
  }

  protected alArrastrar(ev: DragEvent, dentro: boolean): void {
    ev.preventDefault();
    this.arrastrando.set(dentro && this.puedeSubir());
  }

  private agregarArchivos(archivos: File[]): void {
    const rechazados: string[] = [];
    let lugar = this.cupo().restante - this.enCola();
    const nuevos: Archivo[] = [];
    for (const a of archivos) {
      const e = errorDeArchivo(a);
      if (e) rechazados.push(`${a.name}: ${e}`);
      else if (lugar <= 0) rechazados.push(`${a.name}: ya llegaste al máximo de ${this.cupo().maximo} fotos${this.plan() ? ' de tu plan ' + this.plan()?.plan.nombre : ''}.`);
      else {
        lugar -= 1;
        nuevos.push({ clave: ++this.clave, archivo: a, vista: URL.createObjectURL(a), pie: '', paso: 'lista', progreso: 0, error: null });
      }
    }
    this.rechazados.set(rechazados);
    this.aviso.set(null);
    if (nuevos.length) this.cola.update((c) => [...c, ...nuevos]);
  }

  protected cambiarPie(clave: number, texto: string): void {
    this.cola.update((c) => c.map((a) => (a.clave === clave ? { ...a, pie: texto } : a)));
  }

  protected descartar(clave: number): void {
    this.suscripciones.get(clave)?.unsubscribe();
    this.suscripciones.delete(clave);
    this.liberar(clave);
    this.cola.update((c) => c.filter((a) => a.clave !== clave));
    if (this.procesando && !this.ocupada()) this.siguiente();
  }

  protected reintentar(clave: number): void {
    this.marcar(clave, { paso: 'lista', error: null, progreso: 0 });
    this.subirTodas();
  }

  // ---------------- subir ----------------

  protected subirTodas(): void {
    if (this.procesando || this.soloLectura()) return;
    this.procesando = true;
    this.aviso.set(null);
    this.siguiente();
  }

  private siguiente(): void {
    const item = this.cola().find((a) => a.paso === 'lista');
    if (!item) {
      this.procesando = false;
      return;
    }
    this.marcar(item.clave, { paso: 'pidiendo', error: null, progreso: 0 });
    const sub = this.api
      .solicitarSubida(item.archivo.type, item.archivo.size)
      .pipe(
        switchMap((r) => {
          this.marcar(item.clave, { paso: 'subiendo' });
          return this.api.subirArchivo(r.datos, item.archivo).pipe(
            tap((p) => this.marcar(item.clave, { progreso: p })),
            last(),
            map(() => r.datos.medioId),
          );
        }),
        switchMap((medioId) => {
          this.marcar(item.clave, { paso: 'confirmando' });
          return this.api.confirmarSubida(medioId).pipe(map(() => medioId));
        }),
        switchMap((medioId) => {
          this.marcar(item.clave, { paso: 'agregando' });
          return this.api.agregarMedio(this.id(), medioId, item.pie.trim() || null);
        }),
      )
      .subscribe({
        next: (r) => {
          this.ficha.set(r.datos.ficha);
          this.suscripciones.delete(item.clave);
          this.liberar(item.clave);
          this.cola.update((c) => c.filter((a) => a.clave !== item.clave));
          this.aviso.set('Foto subida. Está en revisión; la verás en tu sitio cuando el equipo la apruebe.');
          this.siguiente();
        },
        error: (e) => {
          this.suscripciones.delete(item.clave);
          const paso = this.cola().find((a) => a.clave === item.clave)?.paso;
          // Si falló la subida al almacén (no es nuestra API) la causa más común es la conexión o la configuración del almacén.
          const respaldo = paso === 'subiendo' ? 'No pudimos subir la foto al almacén. Revisa tu conexión e inténtalo de nuevo.' : undefined;
          this.marcar(item.clave, { paso: 'error', error: (paso === 'subiendo' ? leerError(null, respaldo) : leerError(e)).general });
          this.siguiente();
        },
      });
    this.suscripciones.set(item.clave, sub);
  }

  private marcar(clave: number, cambios: Partial<Archivo>): void {
    this.cola.update((c) => c.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)));
  }

  protected textoPaso(a: Archivo): string {
    switch (a.paso) {
      case 'lista': return 'Lista para subir';
      case 'pidiendo': return 'Preparando…';
      case 'subiendo': return `Subiendo… ${a.progreso} %`;
      case 'confirmando': return 'Confirmando…';
      case 'agregando': return 'Agregando a tu ficha…';
      default: return a.error ?? 'No se pudo subir.';
    }
  }

  private liberar(clave: number): void {
    const v = this.cola().find((a) => a.clave === clave)?.vista;
    if (v) URL.revokeObjectURL(v);
  }

  // ---------------- orden, portada y quitar ----------------

  protected mover(i: number, d: -1 | 1): void {
    this.orden.update((o) => mover(o, i, d));
    this.tocado.set(true);
    this.envioOrden.limpiar();
  }

  protected hacerPortada(id: string): void {
    this.portada.set(id);
    this.tocado.set(true);
    this.envioOrden.limpiar();
  }

  protected guardarOrden(): void {
    this.envioOrden.ejecutar(this.api.ordenarMedios(this.id(), this.orden(), this.portada()), (r) => {
      this.tocado.set(false);
      this.ficha.set(r.ficha);
    });
  }

  protected pedirQuitar(id: string): void {
    this.quitandoId.set(id);
    this.envioQuitar.limpiar();
  }

  protected quitar(id: string): void {
    this.envioQuitar.ejecutar(this.api.quitarMedio(this.id(), id), (r) => {
      this.quitandoId.set(null);
      this.ficha.set(r.ficha);
    });
  }

  protected rota(id: string): void {
    this.rotas.update((s) => new Set(s).add(id));
  }
}
