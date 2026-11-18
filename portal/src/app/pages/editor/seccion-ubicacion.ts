import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, DatosSucursal } from '../../core/api';
import {
  DiaEditable, ExcepcionEditable, MAX_FRANJAS, aNumero, coordenadaValida, copiarATodos, diasDesdeHorarios, errorDeExcepciones, errorDeHorarios,
  excepcionesDesdeApi, excepcionesParaApi, hoyIso, horariosParaApi, nombreDia, redondear, vacioANull,
} from '../../core/edicion';
import { Envio } from '../../core/envio';
import { Ficha, Localidad, Municipio, ResultadoCambio, Sucursal } from '../../core/modelos';
import { EstadoGuardado } from '../../shared/estado-guardado';
import { SelectorMapa } from '../../shared/selector-mapa';

interface FormSucursal {
  nombre: string;
  municipioId: string;
  localidadId: string;
  direccionTexto: string;
  referencia: string;
  latitud: string;
  longitud: string;
}

const NUEVA = 'nueva';
const vacia = (): FormSucursal => ({ nombre: '', municipioId: '', localidadId: '', direccionTexto: '', referencia: '', latitud: '', longitud: '' });
const sinAcentos = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sucursales (con su mapa), horarios por día con varias franjas y fechas especiales. */
@Component({
  selector: 'app-seccion-ubicacion',
  imports: [FormsModule, EstadoGuardado, SelectorMapa],
  templateUrl: './seccion-ubicacion.html',
  styleUrl: './seccion-ubicacion.scss',
})
export class SeccionUbicacion {
  private readonly api = inject(Api);
  readonly ficha = input.required<Ficha>();
  readonly municipios = input.required<Municipio[]>();
  readonly soloLectura = input(false);
  readonly guardado = output<ResultadoCambio>();

  protected readonly envioSucursal = new Envio();
  protected readonly envioHorarios = new Envio();
  protected readonly envioFechas = new Envio();

  protected readonly seleccion = signal<string | null>(null);
  protected readonly f = signal<FormSucursal>(vacia());
  protected readonly localidades = signal<Localidad[]>([]);
  protected readonly filtro = signal('');
  protected readonly confirmandoBorrar = signal(false);
  protected readonly dias = signal<DiaEditable[]>([]);
  protected readonly fechas = signal<ExcepcionEditable[]>([]);

  protected readonly maxFranjas = MAX_FRANJAS;
  protected readonly nombreDia = nombreDia;
  protected readonly hoy = hoyIso();

  protected readonly sucursales = computed(() => this.ficha().sucursales ?? []);
  protected readonly actual = computed<Sucursal | null>(() => this.sucursales().find((s) => s.id === this.seleccion()) ?? null);
  protected readonly esNueva = computed(() => this.seleccion() === NUEVA);
  protected readonly publicada = computed(() => this.ficha().estado === 'publicada' || this.ficha().estado === 'pausada');
  protected readonly lat = computed(() => aNumero(this.f().latitud));
  protected readonly lng = computed(() => aNumero(this.f().longitud));
  protected readonly municipioElegido = computed(() => this.municipios().find((m) => m.id === this.f().municipioId) ?? null);
  protected readonly visibles = computed(() => {
    const t = sinAcentos(this.filtro().trim());
    const todos = this.municipios();
    return t ? todos.filter((m) => sinAcentos(m.nombre).includes(t) || m.id === this.f().municipioId) : todos;
  });

  constructor() {
    // Al cargar la ficha se abre la sucursal principal.
    effect(() => {
      const lista = this.sucursales();
      if (this.seleccion() === null && lista.length) this.elegir((lista.find((s) => s.esPrincipal) ?? lista[0]).id);
    });
  }

  // ---------- elegir sucursal ----------
  protected elegir(id: string): void {
    this.seleccion.set(id);
    this.confirmandoBorrar.set(false);
    this.envioSucursal.limpiar();
    this.envioHorarios.limpiar();
    this.envioFechas.limpiar();
    this.filtro.set('');
    if (id === NUEVA) {
      const principal = this.sucursales().find((s) => s.esPrincipal);
      this.f.set({ ...vacia(), municipioId: principal?.municipioId ?? '' });
      this.cargarLocalidades(this.f().municipioId, '');
      this.dias.set([]);
      this.fechas.set([]);
      return;
    }
    const s = this.sucursales().find((x) => x.id === id);
    if (s) {
      this.llenarSucursal(s);
      this.llenarHorarios(s);
    }
  }

  private llenarSucursal(s: Sucursal): void {
    this.f.set({
      nombre: s.nombre ?? '',
      municipioId: s.municipioId,
      localidadId: s.localidadId ?? '',
      direccionTexto: s.direccionTexto ?? '',
      referencia: s.referencia ?? '',
      latitud: s.latitud !== null && s.latitud !== undefined ? String(s.latitud) : '',
      longitud: s.longitud !== null && s.longitud !== undefined ? String(s.longitud) : '',
    });
    this.cargarLocalidades(s.municipioId, s.localidadId ?? '');
  }

  private llenarHorarios(s: Sucursal): void {
    this.dias.set(diasDesdeHorarios(s.horarios ?? []));
    this.fechas.set(excepcionesDesdeApi(s.excepciones ?? []));
  }

  protected cambiarMunicipio(id: string): void {
    this.f.update((x) => ({ ...x, municipioId: id, localidadId: '' }));
    this.cargarLocalidades(id, '');
  }

  private cargarLocalidades(municipioId: string, elegida: string): void {
    this.localidades.set([]);
    if (!municipioId) return;
    this.api.localidades(municipioId).subscribe({
      next: (l) => {
        // Si la persona ya cambió de municipio mientras llegaba la respuesta, se ignora.
        if (this.f().municipioId !== municipioId) return;
        this.localidades.set([...l].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        if (elegida) this.f.update((x) => ({ ...x, localidadId: elegida }));
      },
      error: () => undefined,
    });
  }

  protected alMarcar(p: { latitud: number; longitud: number }): void {
    this.f.update((x) => ({ ...x, latitud: String(redondear(p.latitud)), longitud: String(redondear(p.longitud)) }));
  }

  // ---------- guardar sucursal ----------
  protected guardarSucursal(): void {
    const x = this.f();
    const campos: Record<string, string> = {};
    if (!x.municipioId) campos['municipioId'] = 'Elige el municipio.';
    const lat = aNumero(x.latitud);
    const lng = aNumero(x.longitud);
    if ((x.latitud.trim() && lat === null) || (x.longitud.trim() && lng === null)) campos['latitud'] = 'Escribe solo números, por ejemplo 17.0654.';
    else {
      const c = coordenadaValida(lat, lng);
      if (!c.ok) campos['latitud'] = c.mensaje ?? '';
    }
    if (Object.keys(campos).length) {
      this.envioSucursal.fallar('Revisa los datos marcados.', campos);
      return;
    }
    const cuerpo: DatosSucursal = {
      nombre: vacioANull(x.nombre),
      municipioId: x.municipioId,
      localidadId: x.localidadId || null,
      direccionTexto: vacioANull(x.direccionTexto),
      referencia: vacioANull(x.referencia),
      latitud: lat,
      longitud: lng,
    };
    const id = this.ficha().id;
    if (this.esNueva()) {
      const antes = new Set(this.sucursales().map((s) => s.id));
      this.envioSucursal.ejecutar(this.api.crearSucursal(id, { ...cuerpo, esPrincipal: false }), (r) => {
        this.guardado.emit(r);
        const nueva = r.ficha.sucursales.find((s) => !antes.has(s.id));
        if (nueva) {
          this.seleccion.set(nueva.id);
          this.llenarSucursal(nueva);
          this.llenarHorarios(nueva);
        }
      });
    } else {
      const sid = this.seleccion()!;
      this.envioSucursal.ejecutar(this.api.actualizarSucursal(id, sid, { ...cuerpo, esPrincipal: this.actual()?.esPrincipal }), (r) => {
        this.guardado.emit(r);
        const s = r.ficha.sucursales.find((y) => y.id === sid);
        if (s) this.llenarSucursal(s);
      });
    }
  }

  protected eliminar(): void {
    const sid = this.seleccion();
    if (!sid || this.esNueva()) return;
    this.confirmandoBorrar.set(false);
    this.envioSucursal.ejecutar(this.api.eliminarSucursal(this.ficha().id, sid), (r) => {
      this.guardado.emit(r);
      const principal = r.ficha.sucursales.find((s) => s.esPrincipal) ?? r.ficha.sucursales[0];
      this.seleccion.set(null);
      if (principal) this.elegir(principal.id);
    });
  }

  // ---------- horarios ----------
  protected alternarCerrado(d: DiaEditable): void {
    this.dias.update((l) => l.map((x) => (x.dia !== d.dia ? x : { ...x, cerrado: !x.cerrado, franjas: !x.cerrado ? [] : [{ abre: '09:00', cierra: '18:00' }] })));
  }
  protected abrirDia(d: DiaEditable): void {
    this.dias.update((l) => l.map((x) => (x.dia !== d.dia ? x : { ...x, cerrado: false, franjas: [{ abre: '09:00', cierra: '18:00' }] })));
  }
  protected agregarFranja(d: DiaEditable): void {
    if (d.franjas.length >= MAX_FRANJAS) return;
    this.dias.update((l) => l.map((x) => (x.dia !== d.dia ? x : { ...x, cerrado: false, franjas: [...x.franjas, { abre: '', cierra: '' }] })));
  }
  protected quitarFranja(d: DiaEditable, i: number): void {
    this.dias.update((l) => l.map((x) => (x.dia !== d.dia ? x : { ...x, franjas: x.franjas.filter((_, j) => j !== i) })));
  }
  protected copiar(d: DiaEditable): void {
    this.dias.update((l) => copiarATodos(l, d.dia));
  }

  protected guardarHorarios(): void {
    const sid = this.seleccion();
    if (!sid || this.esNueva()) return;
    const problema = errorDeHorarios(this.dias());
    if (problema) {
      this.envioHorarios.fallar(problema);
      return;
    }
    this.envioHorarios.ejecutar(this.api.guardarHorarios(this.ficha().id, sid, horariosParaApi(this.dias())), (r) => {
      this.guardado.emit(r);
      const s = r.ficha.sucursales.find((y) => y.id === sid);
      if (s) this.dias.set(diasDesdeHorarios(s.horarios ?? []));
    });
  }

  // ---------- fechas especiales ----------
  protected agregarFecha(): void {
    this.fechas.update((l) => [...l, { fecha: '', cerrado: true, abre: '09:00', cierra: '18:00', nota: '' }]);
  }
  protected quitarFecha(i: number): void {
    this.fechas.update((l) => l.filter((_, j) => j !== i));
  }
  protected cambiarFecha(i: number, cambio: Partial<ExcepcionEditable>): void {
    this.fechas.update((l) => l.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  protected guardarFechas(): void {
    const sid = this.seleccion();
    if (!sid || this.esNueva()) return;
    const problema = errorDeExcepciones(this.fechas(), this.hoy);
    if (problema) {
      this.envioFechas.fallar(problema);
      return;
    }
    this.envioFechas.ejecutar(this.api.guardarExcepciones(this.ficha().id, sid, excepcionesParaApi(this.fechas())), (r) => {
      this.guardado.emit(r);
      const s = r.ficha.sucursales.find((y) => y.id === sid);
      if (s) this.fechas.set(excepcionesDesdeApi(s.excepciones ?? []));
    });
  }

  protected trackDia = (_: number, d: DiaEditable): number => d.dia;
  protected readonly NUEVA = NUEVA;
}
