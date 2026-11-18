import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Sesion } from '../../core/sesion';
import { Api } from '../../core/api';
import { Invitacion, Municipio, NegocioResumen } from '../../core/modelos';
import { fechaLarga } from '../../core/comercial';
import { ErrorApi, OpcionCategoria, categoriasElegibles, estadoInfo, inicial, leerError, nombreCategoria, rolTexto } from '../../core/portal';

/** Mis negocios: la lista de la persona y el formulario para registrar uno nuevo (nace en borrador). */
@Component({
  selector: 'app-negocios',
  imports: [FormsModule, RouterLink],
  templateUrl: './negocios.html',
  styleUrl: './negocios.scss',
})
export class Negocios implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);

  protected readonly lista = signal<NegocioResumen[] | null>(null);
  protected readonly fallo = signal(false);
  protected readonly categorias = signal<OpcionCategoria[]>([]);
  protected readonly municipios = signal<Municipio[]>([]);
  protected readonly abierto = signal(false);
  protected readonly catalogoFallo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });

  protected readonly invitaciones = signal<Invitacion[]>([]);
  protected readonly respondiendoId = signal<string | null>(null);
  protected readonly avisoInvitacion = signal<string | null>(null);
  protected readonly errorInvitacion = signal<string | null>(null);
  protected readonly fecha = fechaLarga;

  protected nombre = '';
  protected categoriaId = '';
  protected municipioId = '';
  protected readonly filtro = signal('');

  /** Municipios que coinciden con lo escrito (sin acentos ni mayúsculas); el elegido siempre se queda. */
  protected readonly municipiosVisibles = computed(() => {
    const f = quitarAcentos(this.filtro().trim());
    const todos = this.municipios();
    return f ? todos.filter((m) => quitarAcentos(m.nombre).includes(f) || m.id === this.municipioId) : todos;
  });

  protected readonly nombreUsuario = this.sesion.primerNombre;

  /** Una frase con lo pendiente: borradores por completar e invitaciones. */
  protected readonly resumenTexto = computed(() => {
    const borradores = (this.lista() ?? []).filter((n) => n.estado === 'borrador').length;
    const inv = this.invitaciones().length;
    const partes: string[] = [];
    if (borradores) partes.push(borradores === 1 ? '1 negocio por completar' : `${borradores} negocios por completar`);
    if (inv) partes.push(inv === 1 ? '1 invitación esperando' : `${inv} invitaciones esperando`);
    return partes.length ? `Tienes ${partes.join(' y ')}.` : 'Aquí administras la ficha, las fotos y las promociones de tus negocios.';
  });

  /** Texto del botón de cada tarjeta, según el estado del negocio. */
  protected accion(estado: string): string {
    return (
      { borrador: 'Seguir completando →', en_revision: 'Ver estado', publicada: 'Ver resultados', pausada: 'Reanudar', archivada: 'Ver' } as Record<string, string>
    )[estado] ?? 'Abrir';
  }

  /** Color de la portada cuando no hay foto (siempre el mismo para el mismo nombre). */
  protected tono(nombre: string): number {
    let h = 0;
    for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 4;
    return h;
  }

  protected readonly estadoInfo = estadoInfo;
  protected readonly rolTexto = rolTexto;
  protected readonly inicial = inicial;

  ngOnInit(): void {
    this.cargar();
    this.cargarInvitaciones();
    this.api.categorias().subscribe({ next: (c) => this.categorias.set(categoriasElegibles(c)), error: () => this.catalogoFallo.set(true) });
  }

  protected cargar(): void {
    this.fallo.set(false);
    this.api.misNegocios().subscribe({
      next: (l) => this.lista.set(l),
      error: () => {
        this.fallo.set(true);
        this.lista.set([]);
      },
    });
  }

  /** Las invitaciones son un extra: si no cargan, la lista de negocios sigue igual. */
  private cargarInvitaciones(): void {
    this.api.misInvitaciones().subscribe({ next: (l) => this.invitaciones.set(l), error: () => undefined });
  }

  protected responder(i: Invitacion, acepta: boolean): void {
    if (this.respondiendoId()) return;
    this.errorInvitacion.set(null);
    this.avisoInvitacion.set(null);
    this.respondiendoId.set(i.id);
    this.api.responderInvitacion(i.id, acepta).subscribe({
      next: (r) => {
        this.respondiendoId.set(null);
        this.invitaciones.update((l) => l.filter((x) => x.id !== i.id));
        this.avisoInvitacion.set(acepta ? `Ahora eres parte del equipo de ${i.negocioNombre}.` : (r.mensajes?.[0] ?? 'Invitación rechazada.'));
        if (acepta) this.cargar();
      },
      error: (e) => {
        this.respondiendoId.set(null);
        this.errorInvitacion.set(leerError(e).general);
        this.cargarInvitaciones();
      },
    });
  }

  protected categoriaDe(n: NegocioResumen): string {
    return nombreCategoria(this.categorias(), n.categoriaClave);
  }

  protected abrir(): void {
    this.abierto.set(true);
    if (!this.municipios().length) {
      this.api.municipios().subscribe({ next: (m) => this.municipios.set([...m].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))), error: () => this.catalogoFallo.set(true) });
    }
  }

  protected cancelar(): void {
    this.abierto.set(false);
    this.error.set({ general: null, campos: {} });
  }

  protected campo(n: string): string | null {
    return this.error().campos[n] ?? null;
  }

  protected crear(): void {
    if (this.enviando()) return;
    this.error.set({ general: null, campos: {} });
    const campos: Record<string, string> = {};
    if (!this.nombre.trim()) campos['nombreComercial'] = 'Escribe el nombre del negocio.';
    if (!this.categoriaId) campos['categoriaId'] = 'Elige una categoría.';
    if (!this.municipioId) campos['municipioId'] = 'Elige el municipio.';
    if (Object.keys(campos).length) {
      this.error.set({ general: null, campos });
      return;
    }
    this.enviando.set(true);
    this.api.crearNegocio({ nombreComercial: this.nombre.trim(), categoriaId: this.categoriaId, municipioId: this.municipioId }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        void this.router.navigate(['/negocios', r.datos.id]);
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(leerError(e));
      },
    });
  }
}

function quitarAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
