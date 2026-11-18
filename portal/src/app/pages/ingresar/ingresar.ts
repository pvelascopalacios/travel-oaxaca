import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { SITIO_URL } from '../../core/config';
import { RespuestaSesion } from '../../core/modelos';
import { ErrorApi, destinoSeguro, leerError } from '../../core/portal';
import { Sesion } from '../../core/sesion';

type Vista = 'ingreso' | 'registro' | 'olvide' | 'restablecer' | 'verificar';

const TITULOS: Record<Vista, string> = {
  ingreso: 'Ingresa a tu portal',
  registro: 'Registra tu negocio',
  olvide: '¿Olvidaste tu contraseña?',
  restablecer: 'Escribe tu nueva contraseña',
  verificar: 'Confirmar tu correo',
};

/** Ingreso, registro, recuperar contraseña y confirmar correo (los enlaces de los correos de la API llegan aquí). */
@Component({
  selector: 'app-ingresar',
  imports: [FormsModule, RouterLink],
  templateUrl: './ingresar.html',
  styleUrl: './ingresar.scss',
})
export class Ingresar implements OnInit {
  private readonly api = inject(Api);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);
  protected readonly sitio = inject(SITIO_URL);

  protected readonly vista = signal<Vista>('ingreso');
  protected readonly titulo = computed(() => TITULOS[this.vista()]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly aviso = signal<string | null>(null);

  protected nombre = '';
  protected correo = '';
  protected clave = '';
  protected acepta = false;
  private token = '';
  private volver: string | null = null;

  constructor() {
    // Si ya hay sesión (o aparece al ingresar), se va a donde se iba.
    effect(() => {
      if (this.sesion.autenticado() && (this.vista() === 'ingreso' || this.vista() === 'registro')) {
        void this.router.navigateByUrl(this.volver ?? '/negocios');
      }
    });
  }

  ngOnInit(): void {
    const q = this.ruta.snapshot.queryParamMap;
    this.volver = destinoSeguro(q.get('volver'));
    this.token = q.get('token') ?? '';
    const modo = this.ruta.snapshot.data['modo'] as Vista | undefined;
    if (modo === 'restablecer' || modo === 'verificar') {
      this.vista.set(modo);
      if (modo === 'verificar') this.confirmarCorreo();
    } else if (q.get('modo') === 'registro') {
      this.vista.set('registro');
    }
  }

  protected cambiar(v: Vista): void {
    this.vista.set(v);
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
  }

  protected campo(nombre: string): string | null {
    return this.error().campos[nombre] ?? null;
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    this.enviando.set(true);
    const falla = (e: unknown) => {
      this.enviando.set(false);
      this.error.set(leerError(e));
    };
    const vista = this.vista();
    if (vista === 'ingreso') {
      this.api.ingreso({ correo: this.correo.trim(), clave: this.clave }).subscribe({ next: (r) => this.alEntrar(r.datos), error: falla });
    } else if (vista === 'registro') {
      this.api
        .registro({ correo: this.correo.trim(), clave: this.clave, nombre: this.nombre.trim(), aceptaTerminos: this.acepta })
        .subscribe({ next: (r) => this.alEntrar(r.datos), error: falla });
    } else if (vista === 'olvide') {
      this.api.olvideClave(this.correo.trim()).subscribe({
        next: (r) => {
          this.enviando.set(false);
          this.aviso.set(r.mensajes?.[0] ?? 'Si el correo está registrado, te enviamos las instrucciones.');
        },
        error: falla,
      });
    } else if (vista === 'restablecer') {
      this.api.restablecerClave(this.token, this.clave).subscribe({
        next: () => {
          this.enviando.set(false);
          this.clave = '';
          this.cambiar('ingreso');
          this.aviso.set('Listo, cambiaste tu contraseña. Ya puedes ingresar.');
        },
        error: falla,
      });
    }
  }

  private alEntrar(r: RespuestaSesion): void {
    this.enviando.set(false);
    this.clave = '';
    this.sesion.iniciar(r);
  }

  private confirmarCorreo(): void {
    this.enviando.set(true);
    this.api.verificarCorreo(this.token).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.aviso.set(r.mensajes?.[0] ?? 'Correo confirmado.');
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(leerError(e));
      },
    });
  }
}
