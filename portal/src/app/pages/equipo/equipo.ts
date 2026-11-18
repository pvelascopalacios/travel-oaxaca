import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { errorDeCorreo, estadoMiembro, inicialesDe, miembrosVisibles, rolMiembroTexto } from '../../core/comercial';
import { Ficha, Miembro } from '../../core/modelos';
import { ErrorApi, esPropietario, estadoInfo, leerError } from '../../core/portal';

/** Quiénes pueden administrar el negocio. El propietario invita y quita; los colaboradores solo ven el equipo. */
@Component({
  selector: 'app-equipo',
  imports: [FormsModule],
  templateUrl: './equipo.html',
  styleUrl: './equipo.scss',
})
export class Equipo implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(Api);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly miembros = signal<Miembro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly correo = signal('');
  protected readonly errorCorreo = signal<string | null>(null);
  protected readonly invitando = signal(false);
  protected readonly trabajandoId = signal<string | null>(null);
  protected readonly confirmandoId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly estadoNegocio = estadoInfo;
  protected readonly rol = rolMiembroTexto;
  protected readonly estadoMiembro = estadoMiembro;
  protected readonly iniciales = inicialesDe;

  protected readonly lista = computed(() => miembrosVisibles(this.miembros()));
  protected readonly esDueno = computed(() => esPropietario(this.ficha()?.rolMiembro));
  protected readonly soloLectura = computed(() => this.ficha()?.estado === 'archivada');

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.ficha(this.id()).subscribe({ next: (f) => this.ficha.set(f), error: () => undefined });
    this.api.miembros(this.id()).subscribe({
      next: (l) => {
        this.miembros.set(l);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar el equipo. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }

  protected invitar(): void {
    if (this.invitando()) return;
    this.error.set(null);
    this.aviso.set(null);
    const e = errorDeCorreo(this.correo());
    this.errorCorreo.set(e);
    if (e) return;
    this.invitando.set(true);
    this.api.invitar(this.id(), this.correo().trim()).subscribe({
      next: (r) => {
        this.invitando.set(false);
        this.miembros.set(r.datos);
        this.correo.set('');
        this.aviso.set(r.mensajes?.[0] ?? 'Invitación enviada.');
      },
      error: (er) => {
        this.invitando.set(false);
        const { general, campos } = leerError(er);
        this.errorCorreo.set(campos['correo'] ?? null);
        if (!campos['correo']) this.error.set(general);
      },
    });
  }

  protected pedirQuitar(usuarioId: string): void {
    this.error.set(null);
    this.confirmandoId.set(usuarioId);
  }

  protected quitar(m: Miembro): void {
    if (this.trabajandoId()) return;
    this.error.set(null);
    this.aviso.set(null);
    this.trabajandoId.set(m.usuarioId);
    this.api.revocar(this.id(), m.usuarioId).subscribe({
      next: (r) => {
        this.miembros.set(r.datos);
        this.trabajandoId.set(null);
        this.confirmandoId.set(null);
        this.aviso.set(m.estado === 'invitada' ? 'Invitación cancelada.' : 'Persona quitada del equipo.');
      },
      error: (e) => {
        this.trabajandoId.set(null);
        this.error.set(leerError(e).general);
      },
    });
  }
}
