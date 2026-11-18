import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { Categoria, Ficha, Idioma, Municipio, ResultadoCambio, Servicio } from '../../core/modelos';
import { ErrorApi, categoriasElegibles, estadoInfo, leerError, nombreCategoria } from '../../core/portal';
import { SeccionContacto } from './seccion-contacto';
import { SeccionDatos } from './seccion-datos';
import { SeccionDescripcion } from './seccion-descripcion';
import { SeccionUbicacion } from './seccion-ubicacion';

export const SECCIONES = [
  { clave: 'datos', texto: 'Datos', pista: 'Nombre, categoría, precio', requisito: null },
  { clave: 'descripcion', texto: 'Descripción', pista: 'Corta, completa y políticas', requisito: 'descripcion_corta' },
  { clave: 'ubicacion', texto: 'Ubicación y horarios', pista: 'Mapa, dirección y horarios', requisito: 'ubicacion' },
  { clave: 'contacto', texto: 'Contacto y servicios', pista: 'Teléfono, WhatsApp, servicios', requisito: 'contacto' },
] as const;

/** Textos de lo que falta, por requisito de la API. */
const FALTA: Record<string, string> = {
  descripcion_corta: 'Falta la descripción corta en español',
  ubicacion: 'Falta marcar el mapa',
  contacto: 'Falta un contacto',
  fotos: 'Faltan fotos',
};
const NOMBRE_REQ: Record<string, string> = { descripcion_corta: 'Descripción corta en español', ubicacion: 'Ubicación en el mapa', contacto: 'Contacto', fotos: 'Fotos' };
const ORDEN_REQ = ['descripcion_corta', 'ubicacion', 'contacto', 'fotos'];

/** Editor de la ficha: carga la ficha y los catálogos una sola vez y reparte a cada sección; cada una guarda por su lado. */
@Component({
  selector: 'app-editor',
  imports: [RouterLink, SeccionDatos, SeccionDescripcion, SeccionUbicacion, SeccionContacto],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class Editor implements OnInit {
  /** Vienen de la dirección: /negocios/:id/ficha?seccion=… */
  readonly id = input.required<string>();
  readonly seccion = input<string | undefined>(undefined);
  private readonly api = inject(Api);

  protected readonly secciones = SECCIONES;
  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly idiomas = signal<Idioma[]>([]);
  protected readonly municipios = signal<Municipio[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly catalogoFallo = signal(false);

  protected readonly actual = computed(() => SECCIONES.find((s) => s.clave === this.seccion())?.clave ?? 'datos');
  /** Estado de cada sección según lo que la API dice que falta; sin esa información, ninguna se marca. */
  protected readonly estadoSecciones = computed(() => {
    const falta = this.ficha()?.faltantes ?? null;
    return SECCIONES.map((s) => {
      const incompleta = !!falta && !!s.requisito && falta.includes(s.requisito);
      const ok = !!falta && !incompleta;
      return { ...s, incompleta, ok, nota: incompleta ? FALTA[s.requisito!] : s.pista };
    });
  });
  /** Lista «Para enviarla a revisión»: solo mientras la ficha es borrador y la API informó qué falta. */
  protected readonly requisitos = computed(() => {
    const f = this.ficha();
    if (!f || f.estado !== 'borrador' || !f.faltantes) return [];
    return ORDEN_REQ.map((c) => ({ clave: c, nombre: NOMBRE_REQ[c], falta: f.faltantes!.includes(c) }));
  });
  protected readonly faltanN = computed(() => this.requisitos().filter((q) => q.falta).length);
  protected readonly fotos = computed(() => this.ficha()?.medios?.length ?? 0);
  protected readonly portada = computed(() => {
    const m = this.ficha()?.medios ?? [];
    return (m.find((x) => x.esPortada) ?? m[0])?.url ?? null;
  });
  protected readonly categoria = computed(() => nombreCategoria(categoriasElegibles(this.arbol()), this.ficha()?.categoriaClave ?? ''));
  protected readonly municipio = computed(() => {
    const s = this.ficha()?.sucursales ?? [];
    return (s.find((x) => x.esPrincipal) ?? s[0])?.municipioNombre ?? null;
  });
  protected readonly descCorta = computed(() => this.ficha()?.traducciones?.['es']?.descripcionCorta?.trim() || null);
  protected readonly precio = computed(() => {
    const f = this.ficha();
    if (!f || f.precioDesde == null) return null;
    const u = ({ por_persona: 'por persona', por_noche: 'por noche', por_grupo: 'por grupo' } as Record<string, string>)[f.unidadPrecio ?? ''] ?? '';
    return `Desde $${f.precioDesde} ${u}`.trim();
  });
  protected readonly estado = computed(() => estadoInfo(this.ficha()?.estado ?? ''));
  /** En revisión o archivada la ficha no se edita (la API también lo rechaza). */
  protected readonly soloLectura = computed(() => {
    const e = this.ficha()?.estado;
    return e === 'en_revision' || e === 'archivada';
  });

  ngOnInit(): void {
    this.cargar();
    // Los catálogos se piden aparte: si alguno falla, la ficha se puede ver igual y se avisa.
    forkJoin({ arbol: this.api.categorias(), servicios: this.api.servicios(), idiomas: this.api.idiomas(), municipios: this.api.municipios() }).subscribe({
      next: (c) => {
        this.arbol.set(c.arbol);
        this.servicios.set(c.servicios);
        this.idiomas.set(c.idiomas);
        this.municipios.set([...c.municipios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      },
      error: () => this.catalogoFallo.set(true),
    });
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
  }

  protected alGuardar(r: ResultadoCambio): void {
    this.ficha.set(r.ficha);
  }
}
