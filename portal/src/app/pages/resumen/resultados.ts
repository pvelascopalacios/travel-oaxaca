import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Api } from '../../core/api';
import { Metricas } from '../../core/modelos';
import { ORIGENES, accionesConResultado, cambio, cambioPuntos, fechaCorta, flecha, leerError, numero, trazar } from '../../core/portal';

const ANCHO = 600;
const ALTO = 150;

/** Resultados del negocio: vistas y contactos del periodo contra el anterior, día por día, qué hicieron y de dónde llegaron. */
@Component({
  selector: 'app-resultados',
  templateUrl: './resultados.html',
  styleUrl: './resultados.scss',
})
export class Resultados implements OnInit {
  readonly negocioId = input.required<string>();
  private readonly api = inject(Api);

  protected readonly periodos = [7, 30, 90];
  protected readonly datos = signal<Metricas | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly acciones = computed(() => (this.datos() ? accionesConResultado(this.datos()!) : []));
  protected readonly dVistas = computed(() => cambio(this.datos()?.actual.vistas ?? 0, this.datos()?.anterior?.vistas));
  protected readonly dContactos = computed(() => cambio(this.datos()?.actual.contactos ?? 0, this.datos()?.anterior?.contactos));
  protected readonly dTasa = computed(() => cambioPuntos(this.datos()?.actual.tasaContacto, this.datos()?.anterior?.tasaContacto));
  protected readonly trazo = computed(() => (this.datos()?.serie ? trazar(this.datos()!.serie!, ANCHO, ALTO) : null));
  protected readonly sinVisitas = computed(() => {
    const d = this.datos();
    return !!d && d.actual.vistas === 0 && d.actual.contactos === 0;
  });
  protected readonly rango = computed(() => {
    const d = this.datos();
    if (!d) return '';
    const f = (s: string) => fechaCorta(s, { day: 'numeric', month: 'short' });
    return `${f(d.desde)} – ${fechaCorta(d.hasta, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly numero = numero;
  protected readonly flecha = flecha;
  protected readonly origenes = ORIGENES;
  protected readonly dia = (s: string) => fechaCorta(s, { day: 'numeric', month: 'short' });

  ngOnInit(): void {
    this.cargar(undefined);
  }

  /** Sin periodo la API escoge el suyo (30 días, o la semana del plan Gratis). */
  protected cargar(dias: number | undefined): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.metricas(this.negocioId(), dias).subscribe({
      next: (m) => {
        this.datos.set(m);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(leerError(e, 'No pudimos cargar los resultados. Inténtalo de nuevo.').general);
        this.cargando.set(false);
      },
    });
  }
}
