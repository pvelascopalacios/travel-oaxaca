import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { SITIO_URL } from '../../core/config';
import { Faltantes, Ficha, PlanNegocio, Promocion, Respuesta } from '../../core/modelos';
import { ErrorApi, OpcionCategoria, categoriasElegibles, esPropietario, estadoInfo, fechaCorta, leerError, nombreCategoria, rolTexto } from '../../core/portal';
import { Resultados } from './resultados';

/** Lo que revisa la API antes de enviar a revisión, con su nombre y la sección del editor donde se completa . */
const REQUISITOS: { clave: string; nombre: string; seccion: string | null }[] = [
  { clave: 'descripcion_corta', nombre: 'Descripción corta', seccion: 'descripcion' },
  { clave: 'ubicacion', nombre: 'Ubicación en el mapa', seccion: 'ubicacion' },
  { clave: 'contacto', nombre: 'Contacto', seccion: 'contacto' },
  { clave: 'fotos', nombre: 'Fotos', seccion: 'fotos' },
];

/** Los cuatro pasos de la vida de un negocio en el portal. */
const PASOS = ['Registrado', 'Completar ficha', 'En revisión', 'Publicada'];

type Accion = 'enviar' | 'pausar' | 'reanudar' | 'archivar';

/** Resumen del negocio: estado, lo que falta para enviarlo a revisión, acciones y resultados. */
@Component({
  selector: 'app-resumen',
  imports: [RouterLink, Resultados],
  templateUrl: './resumen.html',
  styleUrl: './resumen.scss',
})
export class Resumen implements OnInit {
  /** Viene de la dirección: /negocios/:id */
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  protected readonly sitio = inject(SITIO_URL);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly faltantes = signal<Faltantes | null>(null);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly confirmando = signal<Accion | null>(null);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly aviso = signal<string | null>(null);

  protected readonly estado = computed(() => estadoInfo(this.ficha()?.estado ?? ''));
  protected readonly propietario = computed(() => esPropietario(this.ficha()?.rolMiembro));
  protected readonly rol = computed(() => rolTexto(this.ficha()?.rolMiembro));
  private readonly catalogo = signal<OpcionCategoria[]>([]);
  protected readonly categoria = computed(() => nombreCategoria(this.catalogo(), this.ficha()?.categoriaClave ?? ''));
  protected readonly municipio = computed(() => {
    const s = this.ficha()?.sucursales ?? [];
    return (s.find((x) => x.esPrincipal) ?? s[0])?.municipioNombre ?? null;
  });
  protected readonly rechazo = computed(() => {
    const r = this.ficha()?.revisionVigente;
    return r && r.estado === 'rechazada' ? r : null;
  });
  protected readonly requisitos = computed(() => {
    const f = this.faltantes();
    if (!f) return [];
    return REQUISITOS.map((r) => ({ ...r, falta: f.faltantes.includes(r.clave), mensaje: f.mensajes[r.clave] ?? null }));
  });
  protected readonly plan = signal<PlanNegocio | null>(null);
  private readonly promos = signal<Promocion[] | null>(null);
  /** Publicada o pausada: se muestra la tarjeta grande del negocio en lugar de los pasos. */
  protected readonly hero = computed(() => this.ficha()?.estado === 'publicada' || this.ficha()?.estado === 'pausada');
  protected readonly portada = computed(() => {
    const m = this.ficha()?.medios ?? [];
    return (m.find((x) => x.esPortada) ?? m[0])?.url ?? null;
  });
  protected readonly usoFotos = computed(() => {
    const u = this.plan()?.uso;
    return u && u.limiteFotos ? Math.min(100, Math.round((u.fotos / u.limiteFotos) * 100)) : 0;
  });
  protected readonly textoPromos = computed(() => {
    const l = this.promos();
    if (l === null) return this.plan() && !this.plan()!.plan.permitePromociones ? 'Disponible con un plan mayor' : 'Crea ofertas por tiempo limitado';
    const n = l.filter((p) => p.estado === 'activa').length;
    return n ? (n === 1 ? '1 activa' : `${n} activas`) : 'Ninguna activa · crea la primera';
  });
  protected readonly pasos = PASOS;
  /** Paso actual (1-4); 0 si está archivada. Borrador = completar ficha; pausada cuenta como publicada. */
  protected readonly paso = computed(() => {
    switch (this.ficha()?.estado) {
      case 'borrador': return 2;
      case 'en_revision': return 3;
      case 'publicada':
      case 'pausada': return 4;
      default: return 0;
    }
  });
  /** Qué hacer ahora: lo primero que falta; si ya no falta nada, enviar a revisión. Solo en borrador. */
  protected readonly siguiente = computed(() => {
    const n = this.ficha();
    const f = this.faltantes();
    if (!n || n.estado !== 'borrador' || !f) return null;
    const faltan = this.requisitos().filter((q) => q.falta);
    const total = this.requisitos().length;
    const pct = f.puntajeFicha ?? n.puntajeFicha;
    if (!faltan.length) {
      return { texto: 'Tu ficha está lista: envíala a revisión.', detalle: `Ficha al ${pct} %`, enlace: null as string[] | null, consulta: undefined as Record<string, string> | undefined };
    }
    const q = faltan[0];
    const enlace = q.seccion === 'fotos' ? ['/negocios', n.id, 'fotos'] : ['/negocios', n.id, 'ficha'];
    return {
      texto: q.mensaje ?? q.nombre,
      detalle: `Faltan ${faltan.length} de ${total} · ficha al ${pct} %`,
      enlace,
      consulta: q.seccion && q.seccion !== 'fotos' ? { seccion: q.seccion } : undefined,
    };
  });
  protected readonly urlSitio = computed(() => `${this.sitio.valor}/es/negocio/${this.ficha()?.slug ?? ''}`);
  protected readonly fechaEnvio = fechaCorta;

  ngOnInit(): void {
    this.cargar();
    this.api.categorias().subscribe({ next: (c) => this.catalogo.set(categoriasElegibles(c)), error: () => undefined });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    forkJoin({ ficha: this.api.ficha(this.id()), faltantes: this.api.faltantes(this.id()) }).subscribe({
      next: (r) => {
        this.ficha.set(r.ficha);
        this.faltantes.set(r.faltantes);
        this.cargando.set(false);
        this.cargarExtras(r.ficha.estado);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar tu negocio. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  /** Plan y promociones solo adornan el resumen de un negocio publicado; si fallan, no pasa nada. */
  private cargarExtras(estado: string): void {
    if (estado !== 'publicada' && estado !== 'pausada') return;
    this.api.plan(this.id()).subscribe({ next: (p) => this.plan.set(p), error: () => undefined });
    this.api.promociones(this.id()).subscribe({ next: (l) => this.promos.set(l), error: () => undefined });
  }

  protected pedir(a: Accion): void {
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    // Enviar y reanudar no destruyen nada: se hacen directo. Pausar y archivar piden confirmación.
    if (a === 'pausar' || a === 'archivar') this.confirmando.set(a);
    else void this.hacer(a);
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  protected hacer(a: Accion): void {
    if (this.trabajando()) return;
    this.confirmando.set(null);
    this.trabajando.set(true);
    this.error.set({ general: null, campos: {} });
    const id = this.id();
    const llamada: Record<Accion, () => import('rxjs').Observable<Respuesta<Ficha | null>>> = {
      enviar: () => this.api.enviarARevision(id),
      pausar: () => this.api.pausar(id),
      reanudar: () => this.api.reanudar(id),
      archivar: () => this.api.archivar(id),
    };
    llamada[a]().subscribe({
      next: (r) => {
        this.trabajando.set(false);
        this.aviso.set(r.mensajes?.[0] ?? null);
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(false);
        this.error.set(leerError(e));
        // Si la API dijo qué falta, se actualiza la lista para que coincida.
        this.api.faltantes(id).subscribe({ next: (f) => this.faltantes.set(f), error: () => undefined });
      },
    });
  }
}
