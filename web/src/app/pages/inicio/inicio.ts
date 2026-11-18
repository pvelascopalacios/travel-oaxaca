import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, OperatorFunction, catchError, of } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogo, DatosCatalogo } from '../../core/catalogo';
import { bloqueDeFecha } from '../../core/ficha';
import { hoyMx, finDeSemanaMx } from '../../core/filtros';
import { I18n } from '../../core/i18n';
import { BloqueInicio, EventoTarjeta, InicioEditorial, LugarTarjeta, NegocioTarjeta, Pagina, Region, RutaTarjeta } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Clave } from '../../core/textos';
import { Buscador } from '../../shared/buscador';
import { Destacado, Diapositiva } from '../../shared/destacado';
import { TarjetaLugar } from '../../shared/tarjeta-lugar';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';

/** Las cuatro entradas del inicio: las mismas del menú, con su ruta y un tono de color. */
interface Entrada {
  clave: 'dormir' | 'comer' | 'descubrir' | 'compras';
  ruta: string;
  titulo: Clave;
  texto: Clave;
  icono: string;
}

const ENTRADAS: Entrada[] = [
  { clave: 'dormir', ruta: 'dormir', titulo: 'grupoDormir', texto: 'descGrupoDormir', icono: 'M3 19v-9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9M3 15h18M3 19v1.5M21 19v1.5M7 12h4' },
  { clave: 'comer', ruta: 'comer-y-beber', titulo: 'grupoComer', texto: 'descGrupoComer', icono: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M5 3v8M17 3c-2 2-3 5-3 8h3v10' },
  { clave: 'descubrir', ruta: 'descubrir', titulo: 'grupoDescubrir', texto: 'descGrupoDescubrir', icono: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5 5-2z' },
  { clave: 'compras', ruta: 'artesanias', titulo: 'grupoCompras', texto: 'descGrupoCompras', icono: 'M6 8h12l1 12H5L6 8zM9 8a3 3 0 0 1 6 0' },
];

/** '/lugar/monte-alban?x=1' → { ruta: ['lugar', 'monte-alban'], queryParams: { x: '1' } }. Solo páginas del sitio. */
function destinoDe(ruta: string | null): { ruta: string[]; queryParams?: Record<string, string> } | null {
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('//')) return null;
  const [camino, consulta] = ruta.split('?');
  const partes = camino.split('/').filter(Boolean);
  if (!partes.length) return null;
  const queryParams = consulta ? Object.fromEntries(new URLSearchParams(consulta).entries()) : undefined;
  return { ruta: partes, queryParams };
}

/** Las diapositivas del destacado sí piden foto; en las filas de resultados, lo que tiene foto va primero. */
const conFoto = <T extends { portadaUrl: string | null }>(x: T) => !!x.portadaUrl;

/**
 * Inicio. Arriba, el titular, el buscador y un destacado que rota; debajo, las cuatro entradas (dormir, comer, descubrir,
 * artesanías), los próximos eventos, una fila de resultados por grupo, y rutas y regiones al final.
 * Destacados, pueblos, historias y Reels los publica el equipo desde el panel (`/publico/inicio`); cada sección se oculta si está vacía.
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, Buscador, Destacado, TarjetaNegocio, TarjetaLugar],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly catalogo = inject(Catalogo);

  protected readonly entradas = ENTRADAS;
  protected readonly alojamientos = signal<NegocioTarjeta[]>([]);
  protected readonly alojamientosTotal = signal(0);
  protected readonly comida = signal<NegocioTarjeta[]>([]);
  protected readonly comidaTotal = signal(0);
  protected readonly lugaresTotal = signal(0);
  protected readonly lugares = signal<LugarTarjeta[]>([]);
  protected readonly eventos = signal<EventoTarjeta[]>([]);
  protected readonly rutas = signal<RutaTarjeta[]>([]);
  protected readonly datos = signal<DatosCatalogo | null>(null);
  protected readonly fallo = signal(false);

  protected readonly regiones = signal<Region[]>([]);
  protected readonly editorial = signal<InicioEditorial>({ destacados: [], pueblos: [], historias: [], reels: [] });
  protected readonly pueblos = computed(() => this.editorial().pueblos);
  protected readonly historias = computed(() => this.editorial().historias);
  protected readonly reels = computed(() => this.editorial().reels);

  /** Solo regiones con algo publicado; una región vacía no es una invitación. */
  protected readonly regionesConContenido = computed(() => this.regiones().filter((r) => r.totalLugares + r.totalNegocios + r.totalEventos > 0));

  /** Atajos Hoy y Este fin de semana, en hora de México para que servidor y navegador coincidan. */
  protected readonly atajos = computed(() => {
    const hoy = hoyMx();
    return { hoy: { desde: hoy, hasta: hoy }, finDeSemana: finDeSemanaMx() };
  });

  /** Primero lo editorial; después lugares destacados con foto, para que nunca quede vacío si ya hay datos. */
  protected readonly diapositivas = computed<Diapositiva[]>(() => {
    const editoriales = this.editorial().destacados.flatMap((d): Diapositiva[] => {
      const destino = destinoDe(d.ruta);
      if (!destino || !d.boton) return [];
      return [{
        id: d.id, etiqueta: d.etiqueta ?? '', titulo: d.titulo, texto: d.texto ?? '', foto: d.fotoUrl,
        credito: d.credito ?? undefined, boton: d.boton, ruta: destino.ruta, queryParams: destino.queryParams,
      }];
    });
    const delaGuia = this.lugares()
      .filter(conFoto)
      .slice(0, Math.max(0, 4 - editoriales.length))
      .map((l) => ({
        id: 'lugar-' + l.id,
        etiqueta: this.i18n.tDinamico('tipo', l.tipo),
        titulo: l.nombre,
        texto: [l.resumen, l.municipioNombre].filter(Boolean)[0] ?? '',
        foto: l.portadaUrl!,
        boton: this.i18n.t('verLugar'),
        ruta: ['lugar', l.slug],
      }));
    return [...editoriales, ...delaGuia].slice(0, 5);
  });

  /** Atajos con una acción concreta: tipos de lugar y mezcal. */
  protected readonly atajosHacer = [
    { texto: 'tipo_arqueologico' as Clave, ruta: ['lugares'], queryParams: { lugar: 'arqueologico' } },
    { texto: 'tipo_playa' as Clave, ruta: ['lugares'], queryParams: { lugar: 'playa' } },
    { texto: 'tipo_mercado' as Clave, ruta: ['lugares'], queryParams: { lugar: 'mercado' } },
    { texto: 'atajoMezcal' as Clave, ruta: ['buscar'], queryParams: { q: 'mezcal' } },
  ];

  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('homeA') + ' ' + this.i18n.t('homeMarca') + ' ' + this.i18n.t('homeB'), this.i18n.t('heroTexto'));
    const vacia = <T>(): Pagina<T> => ({ elementos: [], total: 0, pagina: 1, tamano: 0 });
    const alFallar = <T>(): OperatorFunction<Pagina<T>, Pagina<T>> => catchError((): Observable<Pagina<T>> => {
      this.fallo.set(true);
      return of(vacia<T>());
    });

    this.catalogo.datos().pipe(catchError(() => of(null))).subscribe((d) => {
      this.datos.set(d);
      if (!d) return;
      const idsDe = (raices: string[]) =>
        d.arbol.filter((c) => raices.includes(c.clave)).flatMap((c) => (c.hijas.length ? c.hijas.map((h) => h.id) : [c.id]));
      const alojar = idsDe(['hospedaje']);
      if (alojar.length) {
        this.api
          .negocios({ categoriaIds: alojar, orden: 'calificacion', tamano: 8 })
          .pipe(alFallar<NegocioTarjeta>())
          .subscribe((p) => {
            this.alojamientos.set(this.conFotoPrimero(p.elementos).slice(0, 4));
            this.alojamientosTotal.set(p.total);
          });
      }
      const comer = idsDe(['comida', 'vida_nocturna']);
      if (comer.length) {
        this.api
          .negocios({ categoriaIds: comer, orden: 'calificacion', tamano: 8 })
          .pipe(alFallar<NegocioTarjeta>())
          .subscribe((p) => {
            this.comida.set(this.conFotoPrimero(p.elementos).slice(0, 4));
            this.comidaTotal.set(p.total);
          });
      }
    });
    this.api
      .lugares({ destacado: true, tamano: 8 })
      .pipe(alFallar<LugarTarjeta>())
      .subscribe((p) => {
        this.lugares.set(p.elementos);
        this.lugaresTotal.set(p.total);
      });
    this.api
      .eventos({ desde: hoyMx(), tamano: 4 })
      .pipe(alFallar<EventoTarjeta>())
      .subscribe((p) => this.eventos.set(p.elementos));
    this.api.regiones().pipe(catchError(() => of([] as Region[]))).subscribe((r) => this.regiones.set(r));
    this.api.inicio().pipe(catchError(() => of(null))).subscribe((e) => { if (e) this.editorial.set(e); });
    this.api
      .rutas({ tamano: 4 })
      .pipe(alFallar<RutaTarjeta>())
      .subscribe((p) => this.rutas.set(p.elementos));
  }

  protected enSitio(b: BloqueInicio): boolean {
    return !!b.negocioSlug;
  }

  /** Lo que tiene foto va primero, sin perder el orden de calificación entre iguales. */
  private conFotoPrimero<T extends { portadaUrl: string | null }>(lista: T[]): T[] {
    return [...lista.filter(conFoto), ...lista.filter((x) => !conFoto(x))];
  }

  private numero(v: number): string {
    return v.toLocaleString(this.i18n.lang() === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: 1 });
  }

  protected cuentaRegion(r: Region): string | null {
    if (r.totalLugares) return r.totalLugares === 1 ? this.i18n.t('lugar1') : this.i18n.tf('lugaresN', { n: this.numero(r.totalLugares) });
    if (r.totalNegocios) return r.totalNegocios === 1 ? this.i18n.t('negocio1') : this.i18n.tf('negociosN', { n: this.numero(r.totalNegocios) });
    return null;
  }

  /** La API omite los datos vacíos, así que «sin dato» es null o undefined; comparar solo con null daba «NaN km». */
  protected horas(r: RutaTarjeta): string | null {
    return r.duracionHoras == null || !Number.isFinite(Number(r.duracionHoras)) ? null : this.i18n.tf('duracionHoras', { h: this.numero(Number(r.duracionHoras)) });
  }

  protected km(r: RutaTarjeta): string | null {
    return r.distanciaKm == null || !Number.isFinite(Number(r.distanciaKm)) ? null : this.i18n.tf('distanciaKmRuta', { d: this.numero(Number(r.distanciaKm)) });
  }

  protected fechaBloque(e: EventoTarjeta): { dias: string; mes: string } {
    return bloqueDeFecha(e.fechaInicio, e.fechaFin, (f) => this.i18n.fecha(f, { month: 'short' }));
  }

  protected esGratis(e: EventoTarjeta): boolean {
    return e.datos?.['gratis'] === true;
  }

  protected tono(i: number): string {
    return 'tono-' + (i % 5);
  }
}
