import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ColaItem } from '../../core/modelos';
import { ErrorApi, esperaTexto, leerError, tieneAlgunRol, tipoColaInfo, urgenciaInfo } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { Sesion } from '../../core/sesion';
import { saludo } from '../../core/ui';
import { VacioEstado } from '../../shared/vacio';

interface Tarjeta {
  titulo: string;
  valor: number | null;
  detalle: string;
  ruta: string;
  /** «atencion» resalta la tarjeta cuando hay algo; «normal» solo la pinta de verde si todo está en cero. */
  tono: 'atencion' | 'normal';
}
interface Atajo {
  texto: string;
  ruta: string;
}

/** Primera pantalla del panel: lo que espera hoy, según el rol, y lo que lleva más tiempo en la cola. */
@Component({
  selector: 'app-hoy',
  imports: [RouterLink, VacioEstado],
  templateUrl: './hoy.html',
  styleUrl: './hoy.scss',
})
export class Hoy implements OnInit {
  private readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  protected readonly pendientes = inject(Pendientes);

  private readonly roles = computed(() => this.sesion.usuario()?.roles);
  protected readonly saludo = computed(() => {
    const n = this.sesion.primerNombre();
    return `${saludo(new Date().getHours())}${n ? ', ' + n : ''}`;
  });

  protected readonly revisa = computed(() => tieneAlgunRol(this.roles(), ['admin', 'editor']));

  protected readonly tarjetas = computed<Tarjeta[]>(() => {
    const r = this.roles();
    const p = this.pendientes;
    const t: Tarjeta[] = [];
    if (tieneAlgunRol(r, ['admin', 'editor'])) {
      const partes = p.cargado()
        ? [`${p.fichas() ?? 0} fichas nuevas`, `${p.cambios() ?? 0} cambios`, `${p.fotos() ?? 0} fotos`, `${p.promociones() ?? 0} promociones`].join(' · ')
        : 'Cargando…';
      t.push({ titulo: 'Cola de revisión', valor: p.cargado() ? p.total() : null, detalle: partes, ruta: '/revision', tono: 'atencion' });
      t.push({ titulo: 'Moderación de comunidad', valor: p.comunidad(), detalle: 'Reseñas y reportes por revisar', ruta: '/comunidad', tono: 'normal' });
    }
    if (tieneAlgunRol(r, ['admin', 'ventas'])) {
      t.push({ titulo: 'Prospectos con acción vencida', valor: p.prospectos(), detalle: 'Ventas: dar seguimiento hoy', ruta: '/prospectos', tono: 'normal' });
      t.push({ titulo: 'Pagos por confirmar', valor: p.pagos(), detalle: 'Cobros de planes y patrocinios', ruta: '/cobros', tono: 'normal' });
    }
    if (tieneAlgunRol(r, ['admin'])) {
      t.push({ titulo: 'Solicitudes de privacidad', valor: p.privacidad(), detalle: 'Recibidas, falta responder', ruta: '/privacidad', tono: 'normal' });
      t.push({ titulo: 'Notificaciones fallidas', valor: p.fallidas(), detalle: 'Mensajes que no se pudieron enviar', ruta: '/notificaciones', tono: 'normal' });
    }
    return t;
  });

  protected readonly atajos = computed<Atajo[]>(() => {
    const a: Atajo[] = [];
    if (this.revisa()) a.push({ texto: '+ Nuevo evento', ruta: '/eventos/nuevo' }, { texto: '+ Nueva ruta', ruta: '/rutas/nuevo' }, { texto: '+ Nuevo lugar', ruta: '/lugares/nuevo' });
    a.push({ texto: 'Importar negocios', ruta: '/importaciones' }, { texto: 'Ver métricas', ruta: '/metricas' });
    return a;
  });

  protected readonly esperando = signal<ColaItem[]>([]);
  protected readonly cargando = signal(false);
  protected readonly fallo = signal<ErrorApi | null>(null);

  protected readonly espera = esperaTexto;
  protected readonly tipo = tipoColaInfo;
  protected readonly urgencia = urgenciaInfo;

  ngOnInit(): void {
    const r = this.roles();
    if (tieneAlgunRol(r, ['admin', 'editor'])) { this.pendientes.refrescar(); this.pendientes.refrescarComunidad(); this.cargarEspera(); }
    if (tieneAlgunRol(r, ['admin'])) { this.pendientes.refrescarPrivacidad(); this.pendientes.refrescarFallidas(); }
    if (tieneAlgunRol(r, ['admin', 'ventas'])) { this.pendientes.refrescarPagos(); this.pendientes.refrescarProspectos(); }
  }

  protected cargarEspera(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    // Se pide una tanda y se ordena aquí por horas de espera, para no depender del orden de la API.
    this.api.cola({ tamano: 30 }).subscribe({
      next: (p) => {
        this.esperando.set([...p.elementos].sort((a, b) => b.horasEspera - a.horasEspera).slice(0, 5));
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar la cola. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }
}
