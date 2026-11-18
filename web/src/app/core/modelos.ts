/** Formas de lo que regresa la API pública. Solo los campos que la web usa. */

export interface Respuesta<T> {
  ok: boolean;
  datos: T;
  mensajes: string[];
  errores: Record<string, string>;
}

export interface Pagina<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface NegocioTarjeta {
  id: string;
  slug: string;
  nombre: string;
  categoriaClave: string;
  categoriaNombre: string;
  descripcionCorta: string | null;
  municipioNombre: string;
  regionNombre: string;
  rangoPrecio: number | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  moneda: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaM: number | null;
  abiertoAhora: boolean | null;
  portadaUrl: string | null;
  verificado: boolean;
  calificacionPromedio: number | null;
  totalResenas: number;
  /** Hasta cuatro servicios para las etiquetas; las respuestas antiguas no lo traen. */
  servicios?: ServicioTarjeta[];
}

export interface ServicioTarjeta {
  clave: string;
  nombre: string;
  icono: string | null;
}

export interface LugarTarjeta {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  resumen: string | null;
  municipioNombre: string | null;
  regionNombre: string | null;
  distanciaM: number | null;
  destacado: boolean;
  portadaUrl: string | null;
  datos: Record<string, unknown>;
}

export interface EventoTarjeta {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFin: string;
  municipioNombre: string | null;
  regionNombre: string | null;
  temporadaNombre: string | null;
  datos: Record<string, unknown>;
}

export interface BusquedaGlobal {
  q: string;
  negocios: Pagina<NegocioTarjeta>;
  lugares: Pagina<LugarTarjeta>;
  eventos: Pagina<EventoTarjeta>;
}

export interface Faceta {
  categoriaId: string;
  clave: string;
  nombre: string;
  padreClave: string | null;
  total: number;
}

export interface Facetas {
  negocios: Faceta[];
  lugares: { tipo: string; total: number }[];
  eventos: number;
}

export interface PuntoMapa {
  id: string;
  slug: string;
  nombre: string;
  categoriaClave: string;
  latitud: number;
  longitud: number;
}

export interface Categoria {
  id: string;
  padreId: string | null;
  clave: string;
  nombre: string;
  hijas: Categoria[];
}

export interface Servicio {
  id: string;
  clave: string;
  grupo: string;
  nombre: string;
}

export interface RutaTarjeta {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  duracionHoras: number | null;
  distanciaKm: number | null;
  dificultad: string | null;
  transporte: string | null;
  esPremium: boolean;
}

/** Región con lo publicado en ella; portadaUrl sale de la foto de un lugar de la región. */
export interface Region {
  id: string;
  slug: string;
  nombre: string;
  totalNegocios: number;
  totalLugares: number;
  totalEventos: number;
  portadaUrl: string | null;
}

/** Bloque editorial del inicio. Solo vienen con valor los campos que corresponden a su tipo. */
export interface BloqueInicio {
  id: string;
  etiqueta: string | null;
  titulo: string;
  texto: string | null;
  boton: string | null;
  fotoUrl: string;
  credito: string | null;
  ruta: string | null;
  enlace: string | null;
  comunidades: number | null;
  saludo: string | null;
  saludoIdioma: string | null;
  persona: string | null;
  lugar: string | null;
  negocioSlug: string | null;
}

export interface InicioEditorial {
  destacados: BloqueInicio[];
  pueblos: BloqueInicio[];
  historias: BloqueInicio[];
  reels: BloqueInicio[];
}

// ---------------- fichas ----------------

export interface Horario {
  diaSemana: number; // 0 = domingo … 6 = sábado
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

export interface ExcepcionHorario {
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
  municipioNombre: string | null;
  regionNombre: string | null;
  direccion: string | null;
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
  abiertoAhora: boolean | null;
  horarios: Horario[];
  excepciones: ExcepcionHorario[];
}

export interface Contacto {
  tipo: 'whatsapp' | 'telefono' | 'correo' | 'web' | 'facebook' | 'instagram' | 'tiktok' | 'reservas_url';
  valor: string;
  esPrincipal: boolean;
}

export interface IdiomaNegocio {
  codigo: string;
  nombre: string;
  nivel: string | null;
}

export interface Foto {
  url: string;
  pieTexto: string | null;
  esPortada: boolean;
}

export interface SeoFicha {
  titulo: string;
  descripcion: string;
  rutaCanonica: string | null;
  idiomasDisponibles: string[] | null;
  jsonLd: Record<string, unknown> | null;
}

export interface Oferta {
  id: string;
  tipo: 'habitacion' | 'tour' | 'platillo' | 'producto' | 'experiencia';
  nombre: string;
  descripcion: string | null;
  incluye: string[] | null;
  noIncluye: string[] | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  moneda: string | null;
  duracionMin: number | null;
  capacidad: number | null;
  seccion: string | null;
  etiquetas: string[] | null;
}

export interface Promocion {
  id: string;
  tipo: string;
  valor: number | null;
  codigo: string | null;
  inicio: string | null;
  fin: string | null;
  titulo: string;
  descripcion: string | null;
  condiciones: string | null;
  ofertaId: string | null;
}

export interface NegocioPublico {
  id: string;
  slug: string;
  nombre: string;
  categoriaClave: string;
  categoriaNombre: string;
  rangoPrecio: number | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  moneda: string | null;
  descripcionCorta: string | null;
  descripcion: string | null;
  politicas: string | null;
  atributos: Record<string, unknown> | null;
  verificado: boolean;
  sucursales: Sucursal[];
  contactos: Contacto[];
  servicios: ServicioTarjeta[];
  idiomas: IdiomaNegocio[];
  fotos: Foto[];
  actualizadoEn: string | null;
  seo: SeoFicha | null;
  calificacionPromedio: number | null;
  totalResenas: number;
  promociones: Promocion[];
  patrocinado: boolean;
  grupoClave: string | null;
  ofertas: Oferta[];
  posicion: { posicion: number; total: number; municipioNombre: string | null } | null;
}

export interface LugarPublico {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  resumen: string | null;
  descripcion?: string | null;
  historia: string | null;
  recomendaciones: string | null;
  mejorEpoca: string | null;
  comoLlegar: string | null;
  municipioNombre: string | null;
  regionNombre: string | null;
  latitud: number | null;
  longitud: number | null;
  datos: Record<string, unknown> | null;
  fotos: Foto[];
  atractivos: LugarTarjeta[];
  negociosCercanos: NegocioTarjeta[];
  seo: SeoFicha | null;
}

export interface EventoPublico {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFin: string;
  municipioNombre: string | null;
  regionNombre: string | null;
  temporadaNombre: string | null;
  latitud?: number | null;
  longitud?: number | null;
  datos: Record<string, unknown> | null;
  fotos?: Foto[];
  negocios: NegocioTarjeta[];
  seo: SeoFicha | null;
}

export interface Parada {
  orden: number;
  tipo: 'lugar' | 'negocio' | 'punto';
  lugarId: string | null;
  negocioId: string | null;
  nombre: string;
  slug: string | null;
  latitud: number | null;
  longitud: number | null;
  minutosEstimados: number | null;
}

export interface RutaPublica {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  duracionHoras: number | null;
  distanciaKm: number | null;
  dificultad: string | null;
  transporte: string | null;
  esPremium: boolean;
  paradas: Parada[];
  seo: SeoFicha | null;
}

export interface Resena {
  id: string;
  calificacion: number;
  titulo: string | null;
  texto: string | null;
  fechaVisita: string | null;
  autorNombre: string | null;
  creadoEn: string;
  utiles: number;
  fotos: { url: string }[] | null;
  respuesta: { texto: string; creadoEn: string } | null;
  /** Solo vienen cuando la petición lleva sesión. */
  mia?: boolean;
  yoMarqueUtil?: boolean;
}

export interface ResenasPublicas {
  resenas: Pagina<Resena>;
  calificacion: { promedio: number | null; total: number; distribucion: Record<string, number> };
}

// ---------------- cuentas ----------------

export interface Usuario {
  id: string;
  correo: string;
  nombre: string;
  idiomaCodigo: string | null;
  correoVerificado: boolean;
  roles: string[];
}

export interface RespuestaSesion {
  tokenAcceso: string;
  tokenRenovacion: string;
  expiraEnSegundos: number;
  usuario: Usuario;
}

export interface Tokens {
  tokenAcceso: string;
  tokenRenovacion: string;
  expiraEnSegundos: number;
}

export type TipoFavorito = 'negocio' | 'lugar' | 'ruta';

export interface Favorito {
  tipo: TipoFavorito;
  id: string;
  slug: string;
  nombre: string;
  imagenUrl: string | null;
  creadoEn: string;
}

export interface MiResena {
  id: string;
  calificacion: number;
  titulo: string | null;
  texto: string | null;
  fechaVisita: string | null;
  estado: string | null;
  utiles: number;
  creadoEn: string;
}

export interface MiNegocio {
  id: string;
  slug: string;
  nombreComercial: string;
  estado: string;
  categoriaClave: string;
  rolMiembro: string | null;
  portadaUrl: string | null;
}

export interface ReporteMensual {
  id: string;
  anio: number;
  mes: number;
  generadoEn: string;
  enviadoEn: string | null;
  datos: Record<string, unknown>;
}

export interface PrecioPlan {
  planClave: string;
  destinoId: string | null;
  categoriaId: string | null;
  periodo: 'anual' | 'mensual' | string;
  monto: number;
  moneda: string;
}

/** Plan comercial tal como lo publica la API (`GET /publico/planes`). */
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

// ---------------- perfil de la persona (/mi/…) ----------------

export interface Perfil {
  id: string;
  correo: string;
  nombre: string;
  telefonoE164: string | null;
  idiomaCodigo: string | null;
  estado: string;
  correoVerificado: boolean;
  roles: string[];
  creadoEn: string;
}

export interface SesionActiva {
  id: string;
  plataforma: string;
  versionApp: string | null;
  creadoEn: string;
  expiraEn: string;
  actual: boolean;
}

export type TipoConsentimiento = 'privacidad' | 'terminos' | 'analitica' | 'marketing';

export interface Consentimiento {
  tipo: TipoConsentimiento;
  versionTexto: string;
  aceptado: boolean;
  fecha: string;
}

export type TipoSolicitud = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion';
export type EstadoSolicitud = 'recibida' | 'en_proceso' | 'resuelta' | 'rechazada';

export interface SolicitudPrivacidad {
  id: string;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  detalle: string | null;
  resueltaEn: string | null;
  creadoEn: string;
}

// ---------------- listas e itinerarios, reseñas propias ----------------

export type TipoElemento = 'negocio' | 'lugar' | 'ruta';

export interface ListaResumen {
  id: string;
  nombre: string;
  esItinerario: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  publica: boolean;
  totalElementos: number;
  creadoEn: string;
}

export interface ListaElemento {
  itemId: string;
  tipo: TipoElemento;
  id: string;
  slug: string;
  nombre: string;
  dia: number | null;
  orden: number;
  nota: string | null;
  imagenUrl: string | null;
}

export interface ListaDetalle {
  id: string;
  nombre: string;
  esItinerario: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  publica: boolean;
  autorNombre: string | null;
  elementos: ListaElemento[];
}

export interface ListaEntrada {
  nombre: string;
  esItinerario: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  publica: boolean;
}

export interface ElementoEntrada {
  tipo: TipoElemento;
  id: string;
  dia?: number | null;
  nota?: string | null;
}

export interface ElementoEdicion {
  dia: number | null;
  orden: number | null;
  nota: string | null;
}

export interface ResenaPropia {
  id: string;
  negocioId: string;
  negocioSlug: string;
  negocioNombre: string;
  calificacion: number;
  titulo: string | null;
  texto: string | null;
  fechaVisita: string | null;
  estado: string | null;
  utiles: number;
  creadoEn: string;
}

// ---------------- comentarios y reportes ----------------

export type SeccionComentarios = 'lugares' | 'rutas' | 'eventos';

export interface Comentario {
  id: string;
  padreId: string | null;
  autorNombre: string | null;
  texto: string;
  creadoEn: string;
  meGusta: number;
  estado: string;
  respuestas: Comentario[];
  mio: boolean;
  yoLeDiMeGusta: boolean;
}

export interface Reaccion {
  tipo: string;
  total: number;
}

export type TipoReporte = 'resena' | 'comentario' | 'foto' | 'ficha';

export interface MunicipioOpcion {
  id: string;
  nombre: string;
}

export interface SolicitudContacto {
  nombreNegocio: string;
  contactoNombre: string | null;
  categoriaId: string | null;
  municipioId: string | null;
  telefono: string | null;
  correo: string | null;
  mensaje: string | null;
  /** Señuelo para bots: siempre vacío. */
  sitioWeb: string;
}
