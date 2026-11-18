import { DOCUMENT } from '@angular/common';
import { Component, OnInit, RESPONSE_INIT, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import {
  EnlaceContacto, urlSegura, calificacionVisible, comoLlegarUrl, diaDeSemana, enlaceDeContacto, esNoEncontrado, excepcionesVigentes, filasHorario, hhmm, nombreDia, parrafos, primero,
} from '../../core/ficha';
import { hoyMx } from '../../core/filtros';
import { GRUPOS } from '../../core/grupos';
import { I18n } from '../../core/i18n';
import { Medicion, TipoUso } from '../../core/medicion';
import { NegocioPublico, Oferta } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Galeria } from '../../shared/galeria';
import { Sesion } from '../../core/sesion';
import { Guardar } from '../../shared/guardar';
import { irAIngresar } from '../../shared/pedir-sesion';
import { Reportar } from '../../shared/reportar';
import { GuardarEnLista } from '../../shared/guardar-en-lista';
import { Mapa, Pin } from '../../shared/mapa';
import { NoExiste } from '../../shared/no-existe';
import { Resenas } from '../../shared/resenas';

interface Dato {
  etiqueta: string;
  valor: string;
}

interface GrupoOfertas {
  tipo: Oferta['tipo'];
  secciones: { titulo: string | null; items: Oferta[] }[];
}

/** Ficha de un negocio. La plantilla se adapta al grupo (hospedaje, comida, tours, compras…) y solo muestra lo que tiene datos. */
@Component({
  selector: 'app-negocio',
  imports: [RouterLink, Galeria, Guardar, GuardarEnLista, Mapa, Reportar, Resenas, NoExiste],
  templateUrl: './negocio.html',
  styleUrl: '../ficha.scss',
})
export class Negocio implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly medicion = inject(Medicion);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  protected readonly reportando = signal(false);
  private readonly doc = inject(DOCUMENT);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly n = signal<NegocioPublico | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly fallo = signal(false);
  protected readonly sucursal = signal(0);
  protected readonly copiado = signal(false);
  protected readonly hoyDia = diaDeSemana(hoyMx());

  protected readonly suc = computed(() => {
    const n = this.n();
    if (!n?.sucursales.length) return null;
    return n.sucursales[Math.min(this.sucursal(), n.sucursales.length - 1)];
  });

  protected readonly grupo = computed(() => {
    const clave = this.n()?.grupoClave;
    return GRUPOS.find((g) => g.raices.includes(clave ?? '') || g.raices.includes(this.n()?.categoriaClave ?? '')) ?? null;
  });

  protected readonly calificacion = computed(() => {
    const n = this.n();
    return n ? calificacionVisible(n.calificacionPromedio, n.totalResenas) : null;
  });

  protected readonly whatsapp = computed(() => this.enlace('whatsapp'));
  protected readonly telefono = computed(() => this.enlace('telefono'));
  protected readonly web = computed(() => this.enlace('web'));
  protected readonly reservas = computed(() => this.enlace('reservas_url'));
  protected readonly otros = computed<EnlaceContacto[]>(() => {
    const n = this.n();
    if (!n) return [];
    return n.contactos.map(enlaceDeContacto).filter((e): e is EnlaceContacto => !!e && ['correo', 'facebook', 'instagram', 'tiktok'].includes(e.tipo));
  });

  protected readonly llegar = computed(() => {
    const s = this.suc();
    return s && s.latitud != null && s.longitud != null ? comoLlegarUrl(s.latitud, s.longitud) : null;
  });

  protected readonly pines = computed<Pin[]>(() =>
    (this.n()?.sucursales ?? [])
      .filter((s) => s.latitud != null && s.longitud != null)
      .map((s) => ({ id: s.id, slug: this.n()!.slug, nombre: s.nombre ?? this.n()!.nombre, lat: s.latitud!, lng: s.longitud!, etiqueta: '' })),
  );

  protected readonly filas = computed(() => filasHorario(this.suc()?.horarios ?? []));
  protected readonly tieneHorario = computed(() => !!this.suc()?.horarios.length);
  protected readonly excepciones = computed(() => excepcionesVigentes(this.suc()?.excepciones ?? [], hoyMx()));

  protected readonly datos = computed<Dato[]>(() => this.armarDatos());
  protected readonly ofertas = computed<GrupoOfertas[]>(() => this.agruparOfertas());
  protected readonly descripcion = computed(() => parrafos(this.n()?.descripcion || this.n()?.descripcionCorta));
  protected readonly menuUrl = computed(() => urlSegura(typeof this.n()?.atributos?.['menuUrl'] === 'string' ? (this.n()!.atributos!['menuUrl'] as string) : null));
  protected readonly politicas = computed(() => this.n()?.politicas?.trim() || null);

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((p) => this.cargar(p.get('slug') ?? ''));
  }

  private cargar(slug: string): void {
    this.n.set(null);
    this.noExiste.set(false);
    this.fallo.set(false);
    this.sucursal.set(0);
    this.api.negocio(slug).subscribe({
      next: (n) => {
        this.n.set(n);
        const foto = n.fotos.find((f) => f.esPortada)?.url ?? n.fotos[0]?.url ?? null;
        this.seo.pagina(n.seo?.titulo || n.nombre, n.seo?.descripcion || n.descripcionCorta || '', 'negocio/' + n.slug, {
          imagen: foto,
          idiomas: n.seo?.idiomasDisponibles,
        });
        this.seo.jsonLd(n.seo?.jsonLd);
        this.medicion.registrar('vista_ficha', n.id, n.sucursales[0]?.id);
      },
      error: (e) => {
        if (esNoEncontrado(e)) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        } else {
          this.fallo.set(true);
        }
        this.seo.pagina(this.i18n.t('noEncontrada'), this.i18n.t('noEncontradaTexto'), '', { noIndexar: true });
      },
    });
  }

  private enlace(tipo: Parameters<typeof primero>[1]): EnlaceContacto | null {
    const n = this.n();
    return n ? primero(n.contactos, tipo) : null;
  }

  protected uso(tipo: TipoUso): void {
    const n = this.n();
    if (n) this.medicion.registrar(tipo, n.id, this.suc()?.id);
  }

  protected async compartir(): Promise<void> {
    const n = this.n();
    if (!n) return;
    this.uso('compartido');
    const url = this.doc.location?.href ?? '';
    try {
      const nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator;
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title: n.nombre, url });
        return;
      }
      await nav?.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      /* la persona cerró el cuadro de compartir: no es un error */
    }
  }

  protected dia(d: number): string {
    return nombreDia(d, this.i18n.lang());
  }

  protected hora(h: string | null): string {
    return hhmm(h);
  }

  protected precio(o: { precioDesde: number | null; moneda: string | null }): string {
    return o.precioDesde == null ? '' : this.i18n.precio(o.precioDesde, o.moneda);
  }

  protected duracion(min: number | null): string {
    if (!min) return '';
    if (min < 60) return this.i18n.tf('nMinutos', { n: min });
    const h = Math.round((min / 60) * 10) / 10;
    return this.i18n.tf('nHoras', { n: h });
  }

  protected fechaLarga(iso: string): string {
    return this.i18n.fecha(iso.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected fechaCorta(iso: string): string {
    return this.i18n.fecha(iso.slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short' });
  }

  protected posicionTexto(): string | null {
    const p = this.n()?.posicion;
    if (!p || !p.posicion || !p.total) return null;
    return this.i18n.tf('posicion', { x: p.posicion, y: p.total, lugar: p.municipioNombre ?? 'Oaxaca' });
  }

  protected miniDato(o: Oferta): string[] {
    const m: string[] = [];
    if (o.capacidad) m.push(this.i18n.tf('hastaPersonas', { n: o.capacidad }));
    if (o.duracionMin) m.push(this.duracion(o.duracionMin));
    return m;
  }

  private armarDatos(): Dato[] {
    const n = this.n();
    const a = n?.atributos;
    if (!n || !a) return [];
    const t = (c: Parameters<I18n['t']>[0]) => this.i18n.t(c);
    const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
    const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
    const num = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);
    const d: Dato[] = [];
    const poner = (etiqueta: string, valor: string | null) => {
      if (valor) d.push({ etiqueta, valor });
    };
    switch (n.grupoClave ?? n.categoriaClave) {
      case 'hospedaje':
        poner(t('checkIn'), hhmm(texto(a['horaEntrada'])) || null);
        poner(t('checkOut'), hhmm(texto(a['horaSalida'])) || null);
        if (num(a['numeroHabitaciones'])) poner(t('habitaciones'), this.i18n.tf('nHabitaciones', { n: num(a['numeroHabitaciones'])! }));
        if (typeof a['aceptaNinos'] === 'boolean') poner(t('ninos'), a['aceptaNinos'] ? t('aceptaNinos') : t('noAceptaNinos'));
        break;
      case 'comida':
        poner(t('tipoCocina'), lista(a['tipoCocina']).join(', ') || null);
        poner(t('servicios'), lista(a['serviciosDeMesa']).map((v) => this.i18n.tDinamico('mesa', v)).join(' · ') || null);
        poner(t('precioDesde'), texto(a['rangoPlatillo']));
        break;
      case 'tours':
        if (num(a['duracionHoras'])) poner(t('duracion'), this.i18n.tf('nHoras', { n: num(a['duracionHoras'])! }));
        poner(t('dificultad'), a['dificultad'] ? this.i18n.tDinamico('dificultad', String(a['dificultad'])) : null);
        poner(t('puntoEncuentro'), texto(a['puntoEncuentro']));
        if (num(a['minimoPersonas'])) poner(t('minimo'), this.i18n.tf('minimoPersonas', { n: num(a['minimoPersonas'])! }));
        poner(t('idiomasGuia'), lista(a['idiomasGuia']).map((c) => this.i18n.tDinamico('idioma', c)).join(', ') || null);
        break;
      case 'vida_nocturna':
        if (num(a['edadMinima'])) poner(t('edad'), this.i18n.tf('edadMinima', { n: num(a['edadMinima'])! }));
        poner(t('cover'), texto(a['cover']));
        poner(t('musica'), lista(a['musica']).map((v) => this.i18n.tDinamico('musica', v)).join(' · ') || null);
        break;
      case 'compras':
        poner(t('envios'), a['enviosAlcance'] ? this.i18n.tDinamico('envios', String(a['enviosAlcance'])) : null);
        break;
    }
    return d;
  }

  private agruparOfertas(): GrupoOfertas[] {
    const todas = this.n()?.ofertas ?? [];
    const orden: Oferta['tipo'][] = ['habitacion', 'tour', 'experiencia', 'platillo', 'producto'];
    return orden
      .map((tipo) => {
        const items = todas.filter((o) => o.tipo === tipo);
        const secciones = new Map<string, Oferta[]>();
        for (const o of items) {
          const k = tipo === 'platillo' ? (o.seccion ?? '') : '';
          secciones.set(k, [...(secciones.get(k) ?? []), o]);
        }
        return { tipo, secciones: [...secciones].map(([titulo, its]) => ({ titulo: titulo || null, items: its })) };
      })
      .filter((g) => g.secciones.length);
  }

  protected reportarFicha(): void {
    if (!this.sesion.autenticado()) return irAIngresar(this.router, this.i18n);
    this.reportando.set(true);
  }
}
