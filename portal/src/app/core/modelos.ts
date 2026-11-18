export interface Respuesta<T> {
  ok: boolean;
  datos: T;
  mensajes: string[];
  errores: Record<string, string>;
}

export interface Usuario {
  id: string;
  correo: string;
  nombre: string;
  idiomaCodigo: string | null;
  correoVerificado: boolean;
  roles: string[];
}

export interface Tokens {
  tokenAcceso: string;
  tokenRenovacion: string;
  expiraEnSegundos: number;
}

export interface RespuestaSesion extends Tokens {
  usuario: Usuario;
}

export type EstadoNegocio = 'borrador' | 'en_revision' | 'publicada' | 'pausada' | 'archivada';

/** Fila de «Mis negocios» (GET /mi/negocios). */
export interface NegocioResumen {
  id: string;
  slug: string;
  nombreComercial: string;
  estado: EstadoNegocio | string;
  categoriaId: string;
  categoriaClave: string;
  puntajeFicha: number;
  rolMiembro: 'propietario' | 'colaborador' | string | null;
  portadaUrl: string | null;
  actualizadoEn: string | null;
}

export interface Revision {
  id: string;
  version: number;
  estado: string;
  motivoRechazo: string | null;
  cambios: Record<string, unknown> | null;
  enviadaEn: string | null;
}

export interface Horario {
  diaSemana: number;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

export interface Excepcion {
  fecha: string;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
  nota: string | null;
}

export interface Sucursal {
  id: string;
  nombre: string | null;
  esPrincipal: boolean;
  municipioId: string;
  municipioNombre: string | null;
  localidadId: string | null;
  direccionTexto: string | null;
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
  horarios: Horario[];
  excepciones: Excepcion[];
}

export interface Contacto {
  id: string;
  sucursalId: string | null;
  tipo: string;
  valor: string;
  esPrincipal: boolean;
}

export interface Traduccion {
  descripcionCorta: string | null;
  descripcion: string | null;
  politicas: string | null;
}

export interface IdiomaNivel {
  idiomaCodigo: string;
  nivel: 'basico' | 'fluido' | string;
}

/** La ficha completa (GET /negocios/{id}). */
export interface Ficha {
  id: string;
  slug: string;
  estado: EstadoNegocio | string;
  nombreComercial: string;
  razonSocial: string | null;
  categoriaId: string;
  categoriaClave: string;
  rangoPrecio: number | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  moneda: string | null;
  atributos: Record<string, unknown> | null;
  puntajeFicha: number;
  publicadoEn: string | null;
  verificadoEn: string | null;
  rolMiembro: string | null;
  traducciones: Record<string, Traduccion> | null;
  sucursales: Sucursal[];
  contactos: Contacto[];
  servicioIds: string[];
  idiomas: IdiomaNivel[];
  medios: MedioFicha[];
  ofertas: Oferta[];
  faltantes: string[] | null;
  revisionVigente: Revision | null;
}

/** Respuesta de cada guardado del editor. */
export interface ResultadoCambio {
  aplicado: boolean;
  pendienteDeRevision: boolean;
  ficha: Ficha;
}

export interface Servicio {
  id: string;
  clave: string;
  grupo: string;
  icono: string | null;
  nombre: string;
}

export interface Idioma {
  codigo: string;
  nombre: string;
  esIndigena: boolean;
}

export interface Localidad {
  id: string;
  municipioId: string;
  nombre: string;
}

export interface Faltantes {
  faltantes: string[];
  mensajes: Record<string, string>;
  puntajeFicha: number;
  puedeEnviar: boolean;
}

export interface Totales {
  vistas: number;
  contactos: number;
  tasaContacto: number | null;
}

export interface Metricas {
  dias: number;
  desde: string;
  hasta: string;
  actual: Totales;
  anterior: Totales | null;
  serie: { dia: string; vistas: number; contactos: number }[] | null;
  porTipo: { tipo: string; total: number }[] | null;
  porOrigen: { clave: string; nombre: string; vistas: number; contactos: number }[] | null;
  limitado: boolean;
}

export interface Categoria {
  id: string;
  padreId: string | null;
  clave: string;
  nombre: string;
  hijas: Categoria[];
}

export interface Municipio {
  id: string;
  regionId: string;
  nombre: string;
  latitud?: number | null;
  longitud?: number | null;
}

export interface ReporteMensual {
  id: string;
  anio: number;
  mes: number;
  generadoEn: string;
  enviadoEn: string | null;
  datos: Record<string, unknown>;
}

// ---------------- fotos y opciones (entrega 3) ----------------

/** Foto ligada a la ficha. `moderacion`: aprobado, pendiente o rechazado (con `motivoRechazo`). */
export interface MedioFicha {
  medioId: string;
  url: string;
  orden: number;
  esPortada: boolean;
  pieTexto: string | null;
  moderacion: string;
  motivoRechazo: string | null;
}

export interface SubidaRespuesta {
  medioId: string;
  urlSubida: string;
  metodo: string;
  encabezados: Record<string, string>;
  expiraEnSegundos: number;
}

export interface MedioSubido {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
  moderacion: string;
}

export interface OfertaTraduccion {
  nombre: string;
  descripcion: string | null;
  incluye: string | null;
  noIncluye: string | null;
}

export type TipoOferta = 'habitacion' | 'tour' | 'platillo' | 'producto' | 'experiencia';
export type EstadoOferta = 'borrador' | 'publicada' | 'pausada' | 'archivada';

export interface Oferta {
  id: string;
  tipo: TipoOferta | string;
  estado: EstadoOferta | string;
  precioDesde: number | null;
  unidadPrecio: string | null;
  duracionMin: number | null;
  capacidad: number | null;
  orden: number;
  seccion: string | null;
  etiquetas: string[] | null;
  traducciones: Record<string, OfertaTraduccion> | null;
}

/** Cuerpo de crear o cambiar una opción. */
export interface OfertaEntrada {
  tipo: string;
  precioDesde: number | null;
  unidadPrecio: string | null;
  duracionMin: number | null;
  capacidad: number | null;
  orden: number;
  seccion: string | null;
  etiquetas: string[];
  traducciones: Record<string, OfertaTraduccion>;
}

/** Lo que incluye el plan del negocio y cuánto lleva usado (`GET /negocios/{id}/plan`). */
export interface PlanNegocio {
  plan: { clave: string; nombre: string; limiteFotos: number; limiteOfertas: number; veEstadisticas: boolean; permitePromociones: boolean; permitePatrocinio?: boolean };
  suscripcion: Suscripcion | null;
  uso: { fotos: number; limiteFotos: number; ofertas: number; limiteOfertas: number };
  enGracia: boolean;
  diasRestantes: number | null;
  gratuito: boolean;
}

export interface Suscripcion {
  id: string;
  negocioId: string;
  planClave: string;
  planNombre: string;
  /** activa · gracia · vencida · cancelada */
  estado: string;
  inicio: string;
  fin: string;
  graciaHasta: string | null;
  periodo: string;
  monto: number | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
}

export interface Pago {
  id: string;
  concepto: string;
  monto: number;
  moneda: string;
  metodo: string;
  referenciaExterna: string | null;
  /** pendiente · pagado · fallido · reembolsado */
  estado: string;
  pagadoEn: string | null;
  creadoEn: string;
}

export interface PrecioPlan {
  planClave: string;
  destinoId: string | null;
  categoriaId: string | null;
  periodo: string;
  monto: number;
  moneda: string;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface PlanPublico {
  clave: string;
  nombre: string;
  limiteFotos: number;
  limiteOfertas: number;
  veEstadisticas: boolean;
  permitePromociones: boolean;
  permitePatrocinio: boolean;
  precios: PrecioPlan[];
}

// ---------------- promociones (entrega 4) ----------------

export interface PromocionTexto {
  idioma: string;
  titulo: string;
  descripcion: string | null;
}

export interface Promocion {
  id: string;
  ofertaId: string | null;
  tipo: string;
  valor: number | null;
  codigo: string | null;
  inicio: string;
  fin: string;
  condiciones: string | null;
  /** borrador · en_revision · activa · vencida (si el equipo la rechaza vuelve a borrador con `motivoRechazo`) */
  estado: string;
  motivoRechazo: string | null;
  textos: PromocionTexto[];
}

export interface PromocionEntrada {
  ofertaId: string | null;
  tipo: string;
  valor: number | null;
  codigo: string | null;
  inicio: string;
  fin: string;
  condiciones: string | null;
  textos: PromocionTexto[];
}

// ---------------- equipo ----------------

export interface Miembro {
  usuarioId: string;
  correo: string;
  nombre: string | null;
  /** propietario · colaborador */
  rol: string;
  /** activa · invitada · revocada */
  estado: string;
  creadoEn: string | null;
}

export interface Invitacion {
  id: string;
  negocioId: string;
  negocioNombre: string;
  invitadoPorNombre: string | null;
  creadoEn: string;
}
