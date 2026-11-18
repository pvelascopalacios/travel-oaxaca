import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Api } from '../core/api';
import { Pendientes } from '../core/pendientes';
import { rolPrincipal, rolTexto, tieneAlgunRol } from '../core/panel';
import { Sesion } from '../core/sesion';
import { COLORES_GRUPO, Comando, filtrarComandos } from '../core/ui';
import { AvisosFlotantes } from '../shared/avisos';

interface Enlace {
  texto: string;
  ruta: string;
  exacto?: boolean;
  contador?: number | null;
}
interface Grupo {
  /** Clave del área: decide el ícono y el color. */
  clave: string;
  titulo: string;
  enlaces: Enlace[];
}
interface Pestana {
  texto: string;
  ruta: string;
  icono: string;
  /** Rutas que cuentan como «estar aquí». */
  prefijos: string[];
  contador?: number | null;
}

/** Trazos de los íconos (viewBox 24). Todos se dibujan con contorno, sin relleno. */
const ICONOS: Record<string, string> = {
  hoy: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  revision: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  comunidad: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  ventas: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  negocios: 'M3 21V8l9-5 9 5v13M9 21v-6h6v6',
  contenido: 'M4 4h16v16H4zM4 9h16M9 9v11',
  resultados: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  admin: 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  buscar: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-3.5-3.5',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  flecha: 'M9 6l6 6-6 6',
};

const LLAVE_MENU = 'to_panel_menu';

/** Marco del panel: menú lateral con áreas que se abren y cierran, «Ir a…» (Ctrl K) y barra inferior en el celular. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, NgTemplateOutlet, AvisosFlotantes],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  protected readonly pendientes = inject(Pendientes);

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  protected readonly ruta = computed(() => this.url().split('?')[0]);

  protected readonly rol = computed(() => {
    const r = rolPrincipal(this.sesion.usuario()?.roles);
    return r ? rolTexto(r) : '';
  });

  protected readonly grupos = computed<Grupo[]>(() => {
    const roles = this.sesion.usuario()?.roles;
    const g: Grupo[] = [];
    if (tieneAlgunRol(roles, ['admin', 'editor'])) {
      g.push({
        clave: 'revision',
        titulo: 'Revisión',
        enlaces: [
          { texto: 'Cola', ruta: '/revision', exacto: true, contador: this.pendientes.cargado() ? this.pendientes.total() : null },
          { texto: 'Historial', ruta: '/revision/historial' },
        ],
      });
      g.push({ clave: 'comunidad', titulo: 'Comunidad', enlaces: [{ texto: 'Moderación', ruta: '/comunidad', contador: this.pendientes.comunidad() }] });
    }
    const ventas: Enlace[] = [];
    if (tieneAlgunRol(roles, ['admin', 'ventas'])) ventas.push({ texto: 'Prospectos', ruta: '/prospectos', contador: this.pendientes.prospectos() });
    ventas.push({ texto: 'Importaciones', ruta: '/importaciones' }, { texto: 'Afiliados', ruta: '/afiliados' });
    g.push({ clave: 'ventas', titulo: 'Ventas', enlaces: ventas });
    const negocios: Enlace[] = [{ texto: 'Negocios', ruta: '/negocios' }];
    if (tieneAlgunRol(roles, ['admin', 'ventas'])) negocios.push({ texto: 'Cobros', ruta: '/cobros', contador: this.pendientes.pagos() }, { texto: 'Patrocinios', ruta: '/patrocinios' });
    if (tieneAlgunRol(roles, ['admin'])) negocios.push({ texto: 'Planes y precios', ruta: '/catalogo' });
    g.push({ clave: 'negocios', titulo: 'Negocios y cobros', enlaces: negocios });
    if (tieneAlgunRol(roles, ['admin', 'editor'])) {
      g.push({
        clave: 'contenido',
        titulo: 'Contenido del sitio',
        enlaces: [
          { texto: 'Inicio del sitio', ruta: '/inicio' },
          { texto: 'Lugares', ruta: '/lugares' },
          { texto: 'Rutas', ruta: '/rutas' },
          { texto: 'Eventos', ruta: '/eventos' },
          { texto: 'Catálogos', ruta: '/catalogos' },
          { texto: 'Campañas', ruta: '/campanas' },
        ],
      });
    }
    g.push({ clave: 'resultados', titulo: 'Resultados', enlaces: [{ texto: 'Métricas', ruta: '/metricas' }] });
    if (tieneAlgunRol(roles, ['admin'])) {
      g.push({
        clave: 'admin',
        titulo: 'Administración',
        enlaces: [
          { texto: 'Usuarios y roles', ruta: '/usuarios' },
          { texto: 'Privacidad', ruta: '/privacidad', contador: this.pendientes.privacidad() },
          { texto: 'Plantillas', ruta: '/plantillas' },
          { texto: 'Notificaciones', ruta: '/notificaciones', contador: this.pendientes.fallidas() },
          { texto: 'Configuración', ruta: '/configuracion' },
          { texto: 'Auditoría', ruta: '/auditoria' },
        ],
      });
    }
    return g;
  });

  // ---------------- áreas que se abren y cierran ----------------

  /** Lo que la persona abrió o cerró a mano; lo que no tocó se decide por dónde está. */
  private readonly manual = signal<Record<string, boolean>>(this.leerMenu());

  protected esActivo(e: Enlace): boolean {
    const ruta = this.ruta();
    if (e.ruta === '/revision') return ruta === '/revision' || ruta.startsWith('/revision/negocios');
    return e.exacto ? ruta === e.ruta : ruta === e.ruta || ruta.startsWith(e.ruta + '/');
  }

  protected tieneActivo(g: Grupo): boolean {
    return g.enlaces.some((e) => this.esActivo(e));
  }

  protected abierto(g: Grupo): boolean {
    return this.manual()[g.clave] ?? this.tieneActivo(g);
  }

  protected alternar(g: Grupo): void {
    const nuevo = { ...this.manual(), [g.clave]: !this.abierto(g) };
    this.manual.set(nuevo);
    try { localStorage.setItem(LLAVE_MENU, JSON.stringify(nuevo)); } catch { /* sin almacenamiento: solo se pierde la preferencia */ }
  }

  private leerMenu(): Record<string, boolean> {
    try {
      const v = JSON.parse(localStorage.getItem(LLAVE_MENU) ?? '{}') as unknown;
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  }

  /** Suma de lo pendiente en toda el área. */
  protected contadorGrupo(g: Grupo): number {
    return g.enlaces.reduce((s, e) => s + (e.contador ?? 0), 0);
  }

  protected readonly icono = (clave: string): string => ICONOS[clave] ?? ICONOS['hoy'];
  protected readonly color = (clave: string) => COLORES_GRUPO[clave] ?? COLORES_GRUPO['admin'];

  // ---------------- barra inferior del celular ----------------

  protected readonly pestanas = computed<Pestana[]>(() => {
    const roles = this.sesion.usuario()?.roles;
    const p: Pestana[] = [{ texto: 'Hoy', ruta: '/hoy', icono: 'hoy', prefijos: ['/hoy'] }];
    if (tieneAlgunRol(roles, ['admin', 'editor'])) {
      p.push({ texto: 'Revisión', ruta: '/revision', icono: 'revision', prefijos: ['/revision'], contador: this.pendientes.cargado() ? this.pendientes.total() : null });
    }
    p.push({ texto: 'Negocios', ruta: '/negocios', icono: 'negocios', prefijos: ['/negocios'] });
    if (tieneAlgunRol(roles, ['admin', 'ventas'])) {
      p.push({ texto: 'Ventas', ruta: '/prospectos', icono: 'ventas', prefijos: ['/prospectos', '/importaciones', '/afiliados'], contador: this.pendientes.prospectos() });
    }
    return p;
  });

  protected pestanaActiva(p: Pestana): boolean {
    const ruta = this.ruta();
    return p.prefijos.some((x) => ruta === x || ruta.startsWith(x + '/'));
  }

  protected readonly enMas = computed(() => !this.pestanas().some((p) => this.pestanaActiva(p)));

  protected readonly masAbierto = signal(false);

  // ---------------- «Ir a…» ----------------

  protected readonly paletaAbierta = signal(false);
  protected readonly consulta = signal('');
  protected readonly indice = signal(0);
  private readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');

  private readonly comandos = computed<Comando[]>(() => [
    { texto: 'Hoy', grupo: 'Inicio del panel', ruta: '/hoy' },
    ...this.grupos().flatMap((g) => g.enlaces.map((e) => ({ texto: e.texto, grupo: g.titulo, ruta: e.ruta }))),
  ]);
  protected readonly resultados = computed(() => filtrarComandos(this.comandos(), this.consulta()));

  constructor() {
    // Al cambiar de página se cierran la paleta y el menú «Más».
    effect(() => {
      this.url();
      this.paletaAbierta.set(false);
      this.masAbierto.set(false);
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected teclaGlobal(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.paletaAbierta() ? this.cerrarPaleta() : this.abrirPaleta();
    } else if (e.key === 'Escape') {
      if (this.paletaAbierta()) this.cerrarPaleta();
      else if (this.masAbierto()) this.masAbierto.set(false);
    }
  }

  protected abrirPaleta(): void {
    this.masAbierto.set(false);
    this.consulta.set('');
    this.indice.set(0);
    this.paletaAbierta.set(true);
    setTimeout(() => this.entrada()?.nativeElement.focus());
  }

  protected cerrarPaleta(): void {
    this.paletaAbierta.set(false);
  }

  protected escribir(t: string): void {
    this.consulta.set(t);
    this.indice.set(0);
  }

  protected teclasPaleta(e: KeyboardEvent): void {
    const n = this.resultados().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) this.indice.set((this.indice() + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.indice.set((this.indice() - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = this.resultados()[this.indice()];
      if (c) void this.router.navigateByUrl(c.ruta);
    }
  }

  // ---------------- sesión ----------------

  ngOnInit(): void {
    const roles = this.sesion.usuario()?.roles;
    if (tieneAlgunRol(roles, ['admin', 'editor'])) { this.pendientes.refrescar(); this.pendientes.refrescarComunidad(); }
    if (tieneAlgunRol(roles, ['admin'])) { this.pendientes.refrescarPrivacidad(); this.pendientes.refrescarFallidas(); }
    if (tieneAlgunRol(roles, ['admin', 'ventas'])) { this.pendientes.refrescarPagos(); this.pendientes.refrescarProspectos(); }
  }

  protected salir(): void {
    const t = this.sesion.tokenRenovacion();
    if (t) this.api.salir(t).subscribe({ error: () => undefined });
    this.sesion.cerrarLocal();
    void this.router.navigate(['/ingresar']);
  }
}
