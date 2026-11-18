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

export interface Pagina<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Una solicitud pendiente. `tipo`: ficha_nueva, cambio o foto. `url` solo viene en las fotos. */
export interface ColaItem {
  tipo: 'ficha_nueva' | 'cambio' | 'foto' | string;
  negocioId: string;
  medioId: string | null;
  nombreComercial: string;
  categoriaClave: string;
  municipioNombre: string | null;
  regionId: string | null;
  regionNombre: string | null;
  url: string | null;
  enviadaEn: string;
  horasEspera: number;
  urgencia: 'normal' | 'atencion' | 'urgente' | string;
}

export interface Propietario {
  usuarioId: string;
  nombre: string | null;
  correo: string;
}

export interface Traduccion {
  nombre?: string | null;
  descripcionCorta?: string | null;
  descripcion?: string | null;
  [k: string]: unknown;
}

export interface MedioFicha {
  medioId: string;
  url: string;
  orden: number;
  esPortada: boolean;
  pieTexto: string | null;
  moderacion: string;
  motivoRechazo: string | null;
}

export interface Contacto {
  tipo: string;
  valor: string;
  esPrincipal?: boolean;
}

export interface Sucursal {
  nombre: string | null;
  esPrincipal?: boolean;
  direccionTexto: string | null;
  municipioNombre?: string | null;
}

export interface Revision {
  id: string;
  version: number;
  estado: string;
  motivoRechazo: string | null;
  /** `{ campo: { antes, despues } }` */
  cambios: Record<string, { antes?: unknown; despues?: unknown } | unknown> | null;
  enviadaEn: string | null;
}

export interface FichaRevision {
  id: string;
  slug: string;
  estado: string;
  nombreComercial: string;
  categoriaClave: string;
  rangoPrecio: number | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  puntajeFicha: number;
  traducciones: Record<string, Traduccion> | null;
  sucursales: Sucursal[];
  contactos: Contacto[];
  medios: MedioFicha[];
  faltantes: string[] | null;
  revisionVigente: Revision | null;
}

export interface DetalleRevision {
  tipo: 'ficha_nueva' | 'cambio' | 'foto' | string;
  ficha: FichaRevision;
  propietario: Propietario | null;
  enviadaEn: string | null;
}

/** Una revisión ya resuelta. `resultado`: aprobada, aprobado, rechazada o rechazado. */
export interface Historial {
  tipo: string;
  negocioId: string;
  medioId: string | null;
  nombreComercial: string;
  resultado: string;
  motivo: string | null;
  revisorNombre: string | null;
  resueltaEn: string;
}

export interface PromocionTexto {
  idioma: string;
  titulo: string;
  descripcion: string | null;
}

export interface Promocion {
  id: string;
  negocioId: string;
  ofertaId: string | null;
  tipo: string;
  valor: number | null;
  codigo: string | null;
  inicio: string;
  fin: string;
  condiciones: string | null;
  estado: string;
  motivoRechazo: string | null;
  textos: PromocionTexto[];
}

export interface PromocionCola {
  promocion: Promocion;
  negocioNombre: string;
  enviadaEn: string;
}

export interface Region {
  id: string;
  slug: string;
  nombre: string;
}

export interface Categoria {
  id: string;
  padreId: string | null;
  clave: string;
  nombre: string;
  hijas: Categoria[];
}

// ---------------- entrega 2: negocios y cobros ----------------

export interface NegocioAdmin {
  id: string;
  slug: string;
  nombreComercial: string;
  estado: string;
  categoriaClave: string;
  municipioNombre: string | null;
  puntajeFicha: number;
  origenAlta: string | null;
  creadoEn: string;
  publicadoEn: string | null;
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
  negocioId: string;
  concepto: string;
  suscripcionId: string | null;
  patrocinioId: string | null;
  monto: number;
  moneda: string;
  metodo: string;
  referenciaExterna: string | null;
  /** pendiente · pagado · fallido · reembolsado */
  estado: string;
  pagadoEn: string | null;
  creadoEn: string;
}

export interface ResultadoActivacion {
  suscripcion: Suscripcion;
  pago: Pago;
}

export interface ActivarEntrada {
  planClave: string;
  periodo: string;
  cupon: string | null;
  monto: number | null;
  pagado: boolean;
  metodo: string | null;
  referencia: string | null;
}

export interface PagoEntrada {
  negocioId: string;
  concepto: 'otro' | 'patrocinio';
  patrocinioId: string | null;
  monto: number;
  metodo: string;
  referencia: string | null;
  pagado: boolean;
}

export interface Verificacion {
  id: string;
  negocioId: string;
  metodo: string;
  resultado: string;
  notas: string | null;
  fecha: string;
  vigenteHasta: string | null;
  verificadaPorNombre: string | null;
}

export interface VerificacionEntrada {
  metodo: string;
  resultado: string;
  notas: string | null;
  vigenteHasta: string | null;
}

export interface Plan {
  id: string;
  clave: string;
  nombre: string;
  limiteFotos: number;
  limiteOfertas: number;
  veEstadisticas: boolean;
  permitePromociones: boolean;
  permitePatrocinio: boolean;
  activo: boolean;
  orden: number;
}

export interface PlanEdicion {
  nombre: string;
  limiteFotos: number;
  limiteOfertas: number;
  veEstadisticas: boolean;
  permitePromociones: boolean;
  permitePatrocinio: boolean;
  activo: boolean;
  orden: number | null;
}

export interface Precio {
  id: string;
  planId: string;
  planClave: string;
  destinoId: string | null;
  categoriaId: string | null;
  periodo: string;
  monto: number;
  moneda: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface PrecioEntrada {
  planId: string;
  destinoId: string | null;
  categoriaId: string | null;
  periodo: string;
  monto: number;
  moneda: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  /** pct · monto · periodo_gratis */
  tipo: string;
  valor: number;
  /** suscripcion · patrocinio */
  aplicaA: string;
  maxUsos: number | null;
  usos: number;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface CuponEntrada {
  codigo: string;
  descripcion: string | null;
  tipo: string;
  valor: number;
  aplicaA: string;
  maxUsos: number | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface CuponEdicion {
  descripcion: string | null;
  maxUsos: number | null;
  vigenteHasta: string | null;
}

export interface Destino {
  id: string;
  codigo: string;
  nombre: string;
}

/** Plan tal como lo ve el público (sin id); trae sus precios vigentes. Lo puede leer también ventas. */
export interface PlanPublico {
  clave: string;
  nombre: string;
  limiteFotos: number;
  limiteOfertas: number;
  veEstadisticas: boolean;
  permitePromociones: boolean;
  permitePatrocinio: boolean;
  precios: Precio[];
}

// ---------------- contenido editorial ----------------

export interface Idioma {
  codigo: string;
  nombre: string;
  esIndigena: boolean;
}

export interface ResumenContenido {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
  actualizadoEn: string;
}

export interface TextoBloque {
  etiqueta: string | null;
  titulo: string;
  texto: string | null;
  boton: string | null;
}

export interface BloqueResumen {
  id: string;
  tipo: string;
  orden: number;
  estado: string;
  titulo: string | null;
  publicarDesde: string | null;
  publicarHasta: string | null;
}

export interface BloqueAdmin {
  id: string;
  tipo: string;
  orden: number;
  estado: string;
  publicarDesde: string | null;
  publicarHasta: string | null;
  medioId: string | null;
  fotoUrl: string | null;
  credito: string | null;
  ruta: string | null;
  enlace: string | null;
  comunidades: number | null;
  saludo: string | null;
  saludoIdioma: string | null;
  saludoVerificadoPor: string | null;
  persona: string | null;
  lugar: string | null;
  negocioId: string | null;
  permisoConfirmado: boolean;
  traducciones: Record<string, TextoBloque>;
  actualizadoEn: string;
}

export interface BloqueEntrada {
  tipo: string;
  orden: number | null;
  estado: string;
  publicarDesde: string | null;
  publicarHasta: string | null;
  medioId: string | null;
  credito: string | null;
  ruta: string | null;
  enlace: string | null;
  comunidades: number | null;
  saludo: string | null;
  saludoIdioma: string | null;
  saludoVerificadoPor: string | null;
  persona: string | null;
  lugar: string | null;
  negocioId: string | null;
  permisoConfirmado: boolean;
  traducciones: Record<string, TextoBloque>;
}

export interface TextoLugar {
  nombre: string;
  resumen: string | null;
  historia: string | null;
  recomendaciones: string | null;
  mejorEpoca: string | null;
  comoLlegar: string | null;
}

export interface DatosLugar {
  entrada?: string;
  costoNacional?: number;
  costoExtranjero?: number;
  diasAbierto?: number[];
  horarioTexto?: string;
  accesible?: boolean;
  dificultad?: string;
}

export interface LugarEntrada {
  tipo: string;
  municipioId: string | null;
  padreId: string | null;
  latitud: number | null;
  longitud: number | null;
  destacado: boolean;
  estado: string;
  datos: DatosLugar;
  traducciones: Record<string, TextoLugar>;
}

export interface LugarAdmin extends LugarEntrada {
  id: string;
  slug: string;
  medioIds: string[];
  actualizadoEn: string;
}

export interface TextoRuta {
  nombre: string;
  descripcion: string | null;
}

export interface Parada {
  lugarId: string | null;
  negocioId: string | null;
  latitud: number | null;
  longitud: number | null;
  minutosEstimados: number | null;
}

export interface RutaEntrada {
  duracionHoras: number;
  distanciaKm: number | null;
  dificultad: string;
  transporte: string;
  esPremium: boolean;
  estado: string;
  traducciones: Record<string, TextoRuta>;
  paradas: Parada[];
}

export interface RutaAdmin extends RutaEntrada {
  id: string;
  slug: string;
  actualizadoEn: string;
}

export interface TextoEvento {
  nombre: string;
  descripcion: string | null;
}

export interface DatosEvento {
  gratis?: boolean;
  costoTexto?: string;
  horaInicio?: string;
  horaFin?: string;
  sede?: string;
}

export interface EventoEntrada {
  fechaInicio: string;
  fechaFin: string;
  municipioId: string | null;
  temporadaId: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  datos: DatosEvento;
  traducciones: Record<string, TextoEvento>;
  negocioIds: string[];
}

export interface EventoAdmin extends EventoEntrada {
  id: string;
  slug: string;
  actualizadoEn: string;
}

export interface Municipio {
  id: string;
  regionId: string;
  claveInegi: string | null;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
}

export interface Localidad {
  id: string;
  municipioId: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
}

export interface CategoriaCatalogo {
  id: string;
  padreId: string | null;
  clave: string;
  nombre: string;
  icono: string | null;
  orden: number;
  hijas: CategoriaCatalogo[];
}

export interface ServicioCatalogo {
  id: string;
  clave: string;
  grupo: string;
  icono: string | null;
  nombre: string;
}

export interface CategoriaEntrada {
  padreId: string | null;
  clave: string;
  icono: string | null;
  orden: number | null;
  activa: boolean;
  nombres: Record<string, string>;
}

export interface ServicioEntrada {
  clave: string;
  grupo: string;
  icono: string | null;
  activo: boolean;
  nombres: Record<string, string>;
}

export interface MunicipioEntrada {
  regionId: string;
  claveInegi: string | null;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
}

export interface LocalidadEntrada {
  municipioId: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
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

// ---------------- comunidad, usuarios y privacidad (entrega 4) ----------------

export interface ItemComunidad {
  tipo: string;
  id: string;
  estado: string;
  resumen: string | null;
  motivo: string | null;
  reportes: number;
  negocioId: string | null;
  creadoEn: string;
}

export interface UsuarioAdmin {
  id: string;
  correo: string;
  nombre: string | null;
  estado: string;
  idiomaCodigo: string | null;
  correoVerificado: boolean;
  ultimoAccesoEn: string | null;
  creadoEn: string;
  roles: string[];
}

export interface SolicitudPrivacidad {
  id: string;
  usuarioId: string;
  correoUsuario: string;
  tipo: string;
  estado: string;
  detalle: string | null;
  resueltaEn: string | null;
  creadoEn: string;
}

// ---------------- ventas (entrega 5A) ----------------

export interface ProspectoResumen {
  id: string;
  nombreNegocio: string;
  categoriaId: string | null;
  categoriaClave: string | null;
  municipioId: string | null;
  municipioNombre: string | null;
  contactoNombre: string | null;
  telefono: string | null;
  correo: string | null;
  origen: string | null;
  estado: string;
  asignadoA: string | null;
  asignadoNombre: string | null;
  negocioId: string | null;
  proximaAccionEn: string | null;
  vencida: boolean;
  actualizadoEn: string;
}

export interface Interaccion {
  id: string;
  tipo: string;
  resultado: string | null;
  notas: string | null;
  ocurrioEn: string;
  proximaAccionEn: string | null;
  usuarioId: string | null;
  usuarioNombre: string | null;
}

export interface ProspectoDetalle {
  prospecto: ProspectoResumen;
  motivoDescarte: string | null;
  notas: string | null;
  creadoEn: string;
  interacciones: Interaccion[];
}

export interface ProspectoEntrada {
  nombreNegocio: string;
  categoriaId: string | null;
  municipioId: string | null;
  contactoNombre: string | null;
  telefono: string | null;
  correo: string | null;
  origen: string | null;
  asignadoA: string | null;
  proximaAccionEn: string | null;
  notas: string | null;
}

export interface InteraccionEntrada {
  tipo: string;
  resultado: string | null;
  notas: string | null;
  ocurrioEn: string | null;
  proximaAccionEn: string | null;
}

export interface ResumenVentas {
  porEstado: Record<string, number>;
  vencidas: number;
  sinAsignar: number;
  convertidosMes: number;
}

export interface PersonaEquipo {
  id: string;
  nombre: string;
}

export interface ErrorFila {
  fila: number;
  campo: string | null;
  valor: string | null;
  problema: string;
}

export interface Importacion {
  id: string;
  tipo: string;
  archivo: string;
  estado: string;
  totalFilas: number;
  filasOk: number;
  filasError: number;
  creadoEn: string;
  finalizadaEn: string | null;
  errores: ErrorFila[] | null;
}

export interface Afiliado {
  id: string;
  codigo: string;
  destinoUrl: string;
  socio: string;
  comisionPct: number | null;
  estado: string;
  negocioId: string | null;
  clics30d: number;
  creadoEn: string;
}

export interface AfiliadoEntrada {
  codigo: string;
  destinoUrl: string;
  socio: string;
  comisionPct: number | null;
  negocioId: string | null;
  estado: string;
}

export interface ClicDia {
  dia: string;
  clics: number;
}

export interface Conversion {
  negocioId: string;
  slug: string;
}

// ---------------- entrega 5B: operación ----------------

export interface Espacio {
  id: string;
  destinoId: string | null;
  clave: string;
  categoriaId: string | null;
  regionId: string | null;
  maxSimultaneos: number;
  activo: boolean;
}

export interface EspacioEntrada {
  destinoId: string | null;
  clave: string;
  categoriaId: string | null;
  regionId: string | null;
  maxSimultaneos: number;
  activo: boolean;
}

export interface Patrocinio {
  id: string;
  espacioId: string;
  espacioClave: string;
  negocioId: string;
  negocioNombre: string;
  inicio: string;
  fin: string;
  estado: string;
  precio: number;
  moneda: string;
  pagoId: string | null;
}

export interface PatrocinioEntrada {
  espacioId: string;
  negocioId: string;
  inicio: string;
  fin: string;
  precio: number;
  cupon: string | null;
  pago: { metodo: string; referencia: string | null; pagado: boolean } | null;
}

export interface NegocioRanking {
  negocioId: string;
  slug: string;
  nombre: string;
  categoriaClave: string;
  vistas: number;
  contactos: number;
  tasaContacto: number | null;
  ultimoContacto: string | null;
  diasSinContacto: number;
}

export interface MetricasGenerales {
  dias: number;
  desde: string;
  hasta: string;
  vistas: number;
  contactos: number;
  tasaContacto: number | null;
  dispositivosActivos: number;
  negocios: NegocioRanking[];
}

export interface Origen {
  clave: string;
  nombre: string;
}

export interface Campana {
  id: string;
  origenClave: string;
  origenNombre: string;
  codigo: string;
  nombre: string;
  inicio: string | null;
  fin: string | null;
  vistas: number;
  contactos: number;
}

export interface CampanaEntrada {
  origen: string;
  codigo?: string;
  nombre: string;
  inicio: string | null;
  fin: string | null;
}

export interface Auditoria {
  id: number;
  tabla: string;
  registroId: string;
  accion: string;
  usuarioId: string | null;
  usuarioCorreo: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  ocurrioEn: string;
}

export interface Configuracion {
  clave: string;
  tipo: string;
  valor: unknown;
  minimo: number | null;
  maximo: number | null;
  descripcion: string | null;
  actualizadoEn: string | null;
}

export interface Plantilla {
  id: string;
  clave: string;
  canal: string;
  idioma: string;
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
  variables: string[];
}

export interface PlantillaEdicion {
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
}

export interface Notificacion {
  id: string;
  plantillaClave: string;
  canal: string;
  destinatario: string;
  estado: string;
  intentos: number;
  error: string | null;
  programadaPara: string | null;
  enviadaEn: string | null;
  creadoEn: string;
}
