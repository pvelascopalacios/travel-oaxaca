import { HttpClient, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, timeout } from 'rxjs';
import { API_URL } from './config';
import { AccionCola, rutaAccion } from './comunidad';
import {
  ActivarEntrada, Categoria, ColaItem, Cupon, CuponEdicion, CuponEntrada, DetalleRevision, Destino, PlanPublico, FichaRevision, Historial, NegocioAdmin, Pagina, Pago, PagoEntrada, Plan, PlanEdicion, Precio,
  PrecioEntrada, Promocion, PromocionCola, Region, Respuesta, RespuestaSesion, ResultadoActivacion, Suscripcion, Verificacion, VerificacionEntrada,
  BloqueAdmin, BloqueEntrada, BloqueResumen, CategoriaCatalogo, CategoriaEntrada, EventoAdmin, EventoEntrada, Idioma, Localidad, LocalidadEntrada, LugarAdmin, LugarEntrada, MedioSubido,
  Municipio, MunicipioEntrada, ResumenContenido, RutaAdmin, RutaEntrada, ServicioCatalogo, ServicioEntrada, SubidaRespuesta,
  ItemComunidad, SolicitudPrivacidad, UsuarioAdmin,
  Auditoria, Campana, CampanaEntrada, Configuracion, Espacio, EspacioEntrada, MetricasGenerales, Notificacion, Origen, Patrocinio, PatrocinioEntrada, Plantilla, PlantillaEdicion,
  Afiliado, AfiliadoEntrada, ClicDia, Conversion, Importacion, InteraccionEntrada, PersonaEquipo, ProspectoDetalle, ProspectoEntrada, ProspectoResumen, ResumenVentas,
} from './modelos';

export interface FiltroNegocios {
  q?: string | null;
  estado?: string | null;
  categoriaId?: string | null;
  municipioId?: string | null;
  pagina?: number;
  tamano?: number;
}

export interface FiltroCola {
  tipo?: string | null;
  regionId?: string | null;
  categoriaId?: string | null;
  pagina?: number;
  tamano?: number;
}

/** Todas las llamadas del panel. Los errores llegan tal cual para leerlos con `leerError`. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  private ver<T>(ruta: string): Observable<T> {
    return this.http.get<Respuesta<T>>(this.base + ruta).pipe(timeout(15000), map((r) => r.datos));
  }

  private enviar<T>(metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Observable<Respuesta<T>> {
    return this.http.request<Respuesta<T>>(metodo, this.base + ruta, { body: cuerpo }).pipe(timeout(15000));
  }

  // ---- cuenta ----
  ingreso(cuerpo: { correo: string; clave: string }): Observable<Respuesta<RespuestaSesion>> {
    return this.enviar('POST', '/auth/ingreso', cuerpo);
  }
  salir(tokenRenovacion: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/salir', { tokenRenovacion });
  }

  // ---- catálogos para los filtros ----
  regiones(): Observable<Region[]> {
    return this.ver('/publico/regiones');
  }
  categorias(): Observable<Categoria[]> {
    return this.ver('/publico/categorias?idioma=es');
  }

  // ---- revisión de fichas y fotos ----
  cola(f: FiltroCola = {}): Observable<Pagina<ColaItem>> {
    const q = new URLSearchParams();
    if (f.tipo) q.set('tipo', f.tipo);
    if (f.regionId) q.set('regionId', f.regionId);
    if (f.categoriaId) q.set('categoriaId', f.categoriaId);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/revision/cola?' + q.toString());
  }
  detalle(negocioId: string): Observable<DetalleRevision> {
    return this.ver(`/revision/negocios/${negocioId}`);
  }
  aprobarNegocio(negocioId: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/revision/negocios/${negocioId}/aprobar`);
  }
  rechazarNegocio(negocioId: string, motivo: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/revision/negocios/${negocioId}/rechazar`, { motivo });
  }
  aprobarFoto(medioId: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/revision/medios/${medioId}/aprobar`);
  }
  rechazarFoto(medioId: string, motivo: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/revision/medios/${medioId}/rechazar`, { motivo });
  }
  historial(pagina = 0, tamano = 20): Observable<Pagina<Historial>> {
    return this.ver(`/revision/historial?pagina=${pagina}&tamano=${tamano}`);
  }

  // ---- promociones por aprobar ----
  colaPromociones(pagina = 0, tamano = 20): Observable<Pagina<PromocionCola>> {
    return this.ver(`/revision/promociones?pagina=${pagina}&tamano=${tamano}`);
  }
  aprobarPromocion(id: string): Observable<Respuesta<Promocion>> {
    return this.enviar('POST', `/revision/promociones/${id}/aprobar`);
  }
  rechazarPromocion(id: string, motivo: string): Observable<Respuesta<Promocion>> {
    return this.enviar('POST', `/revision/promociones/${id}/rechazar`, { motivo });
  }

  // ---- negocios (equipo interno) ----
  negocios(f: FiltroNegocios = {}): Observable<Pagina<NegocioAdmin>> {
    const q = new URLSearchParams();
    if (f.q?.trim()) q.set('q', f.q.trim());
    if (f.estado) q.set('estado', f.estado);
    if (f.categoriaId) q.set('categoriaId', f.categoriaId);
    if (f.municipioId) q.set('municipioId', f.municipioId);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/admin/negocios?' + q.toString());
  }
  negocio(id: string): Observable<FichaRevision> {
    return this.ver(`/admin/negocios/${id}`);
  }
  /** Municipios que coinciden con lo escrito (para el filtro de negocios). */
  buscarMunicipios(texto: string): Observable<{ id: string; nombre: string }[]> {
    return this.ver(`/publico/municipios?q=${encodeURIComponent(texto)}&limite=8`);
  }
  planesPublicos(): Observable<PlanPublico[]> {
    return this.ver('/publico/planes');
  }
  destinos(): Observable<Destino[]> {
    return this.ver('/publico/destinos');
  }

  // ---- suscripciones y pagos (admin y ventas) ----
  suscripciones(negocioId: string): Observable<Suscripcion[]> {
    return this.ver(`/negocios/${negocioId}/suscripciones`);
  }
  activarPlan(negocioId: string, cuerpo: ActivarEntrada): Observable<Respuesta<ResultadoActivacion>> {
    return this.enviar('POST', `/admin/negocios/${negocioId}/suscripciones`, cuerpo);
  }
  cancelarSuscripcion(id: string, motivo: string): Observable<Respuesta<Suscripcion>> {
    return this.enviar('POST', `/admin/suscripciones/${id}/cancelar`, { motivo });
  }
  pagosPendientes(): Observable<Pago[]> {
    return this.ver('/admin/pagos/pendientes');
  }
  cambiarEstadoPago(id: string, estado: string, referencia: string | null): Observable<Respuesta<Pago>> {
    return this.enviar('POST', `/admin/pagos/${id}/estado`, { estado, referencia });
  }
  registrarPago(cuerpo: PagoEntrada): Observable<Respuesta<Pago>> {
    return this.enviar('POST', '/admin/pagos', cuerpo);
  }

  // ---- verificación (admin y editor) ----
  verificaciones(negocioId: string): Observable<Verificacion[]> {
    return this.ver(`/admin/negocios/${negocioId}/verificaciones`);
  }
  registrarVerificacion(negocioId: string, cuerpo: VerificacionEntrada): Observable<Respuesta<Verificacion>> {
    return this.enviar('POST', `/admin/negocios/${negocioId}/verificaciones`, cuerpo);
  }

  // ---- planes, precios y cupones (solo admin) ----
  planes(): Observable<Plan[]> {
    return this.ver('/admin/planes');
  }
  actualizarPlan(id: string, cuerpo: PlanEdicion): Observable<Respuesta<Plan>> {
    return this.enviar('PUT', `/admin/planes/${id}`, cuerpo);
  }
  precios(): Observable<Precio[]> {
    return this.ver('/admin/precios');
  }
  crearPrecio(cuerpo: PrecioEntrada): Observable<Respuesta<Precio>> {
    return this.enviar('POST', '/admin/precios', cuerpo);
  }
  cerrarPrecio(id: string, hasta: string | null): Observable<Respuesta<Precio>> {
    return this.enviar('POST', `/admin/precios/${id}/cerrar${hasta ? '?hasta=' + hasta : ''}`);
  }
  cupones(): Observable<Cupon[]> {
    return this.ver('/admin/cupones');
  }
  crearCupon(cuerpo: CuponEntrada): Observable<Respuesta<Cupon>> {
    return this.enviar('POST', '/admin/cupones', cuerpo);
  }
  actualizarCupon(id: string, cuerpo: CuponEdicion): Observable<Respuesta<Cupon>> {
    return this.enviar('PUT', `/admin/cupones/${id}`, cuerpo);
  }

  // ---- contenido editorial (admin y editor) ----
  idiomas(): Observable<Idioma[]> {
    return this.ver('/publico/idiomas');
  }
  bloques(f: { tipo?: string | null; estado?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<BloqueResumen>> {
    const q = new URLSearchParams();
    if (f.tipo) q.set('tipo', f.tipo);
    if (f.estado) q.set('estado', f.estado);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/admin/inicio?' + q.toString());
  }
  bloque(id: string): Observable<BloqueAdmin> {
    return this.ver(`/admin/inicio/${id}`);
  }
  crearBloque(cuerpo: BloqueEntrada): Observable<Respuesta<BloqueAdmin>> {
    return this.enviar('POST', '/admin/inicio', cuerpo);
  }
  actualizarBloque(id: string, cuerpo: BloqueEntrada): Observable<Respuesta<BloqueAdmin>> {
    return this.enviar('PUT', `/admin/inicio/${id}`, cuerpo);
  }
  archivarBloque(id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/admin/inicio/${id}`);
  }

  contenidos(tipo: 'lugares' | 'rutas' | 'eventos', f: { q?: string | null; estado?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<ResumenContenido>> {
    const q = new URLSearchParams();
    if (f.q?.trim()) q.set('q', f.q.trim());
    if (f.estado) q.set('estado', f.estado);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver(`/admin/${tipo}?` + q.toString());
  }
  archivarContenido(tipo: 'lugares' | 'rutas' | 'eventos', id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/admin/${tipo}/${id}`);
  }
  lugar(id: string): Observable<LugarAdmin> {
    return this.ver(`/admin/lugares/${id}`);
  }
  crearLugar(cuerpo: LugarEntrada): Observable<Respuesta<LugarAdmin>> {
    return this.enviar('POST', '/admin/lugares', cuerpo);
  }
  actualizarLugar(id: string, cuerpo: LugarEntrada): Observable<Respuesta<LugarAdmin>> {
    return this.enviar('PUT', `/admin/lugares/${id}`, cuerpo);
  }
  fotosLugar(id: string, medioIds: string[]): Observable<Respuesta<LugarAdmin>> {
    return this.enviar('PUT', `/admin/lugares/${id}/fotos`, { medioIds });
  }
  ruta(id: string): Observable<RutaAdmin> {
    return this.ver(`/admin/rutas/${id}`);
  }
  crearRuta(cuerpo: RutaEntrada): Observable<Respuesta<RutaAdmin>> {
    return this.enviar('POST', '/admin/rutas', cuerpo);
  }
  actualizarRuta(id: string, cuerpo: RutaEntrada): Observable<Respuesta<RutaAdmin>> {
    return this.enviar('PUT', `/admin/rutas/${id}`, cuerpo);
  }
  evento(id: string): Observable<EventoAdmin> {
    return this.ver(`/admin/eventos/${id}`);
  }
  crearEvento(cuerpo: EventoEntrada): Observable<Respuesta<EventoAdmin>> {
    return this.enviar('POST', '/admin/eventos', cuerpo);
  }
  actualizarEvento(id: string, cuerpo: EventoEntrada): Observable<Respuesta<EventoAdmin>> {
    return this.enviar('PUT', `/admin/eventos/${id}`, cuerpo);
  }

  // ---- fotos: pedir URL firmada → subir directo al almacén → confirmar ----
  solicitarSubida(mime: string, bytes: number): Observable<Respuesta<SubidaRespuesta>> {
    return this.enviar('POST', '/mi/medios/subida', { mime, bytes });
  }
  /** Sube el archivo a la URL firmada. Emite el avance (0–100). No lleva nuestro token (la URL no es de la API). */
  subirArchivo(s: SubidaRespuesta, archivo: File): Observable<number> {
    const encabezados = new HttpHeaders(s.encabezados ?? {});
    return this.http.request(s.metodo || 'PUT', s.urlSubida, { body: archivo, headers: encabezados, reportProgress: true, observe: 'events' }).pipe(
      map((e: HttpEvent<unknown>) => (e.type === HttpEventType.UploadProgress ? Math.round((100 * e.loaded) / (e.total ?? archivo.size)) : e.type === HttpEventType.Response ? 100 : -1)),
      filter((n) => n >= 0),
    );
  }
  confirmarSubida(medioId: string): Observable<Respuesta<MedioSubido>> {
    return this.enviar('POST', `/mi/medios/${medioId}/confirmar`);
  }

  // ---- catálogos ----
  municipiosDeRegion(regionId: string): Observable<Municipio[]> {
    return this.ver(`/publico/municipios?regionId=${regionId}&limite=300`);
  }
  localidades(municipioId: string): Observable<Localidad[]> {
    return this.ver(`/publico/municipios/${municipioId}/localidades`);
  }
  categoriasCatalogo(idioma = 'es'): Observable<CategoriaCatalogo[]> {
    return this.ver(`/publico/categorias?idioma=${idioma}`);
  }
  serviciosCatalogo(): Observable<ServicioCatalogo[]> {
    return this.ver('/publico/servicios?idioma=es');
  }
  crearCategoria(c: CategoriaEntrada): Observable<Respuesta<{ id: string }>> {
    return this.enviar('POST', '/admin/categorias', c);
  }
  actualizarCategoria(id: string, c: CategoriaEntrada): Observable<Respuesta<null>> {
    return this.enviar('PUT', `/admin/categorias/${id}`, c);
  }
  crearServicio(c: ServicioEntrada): Observable<Respuesta<{ id: string }>> {
    return this.enviar('POST', '/admin/servicios', c);
  }
  actualizarServicio(id: string, c: ServicioEntrada): Observable<Respuesta<null>> {
    return this.enviar('PUT', `/admin/servicios/${id}`, c);
  }
  crearMunicipio(c: MunicipioEntrada): Observable<Respuesta<{ id: string }>> {
    return this.enviar('POST', '/admin/municipios', c);
  }
  actualizarMunicipio(id: string, c: MunicipioEntrada): Observable<Respuesta<null>> {
    return this.enviar('PUT', `/admin/municipios/${id}`, c);
  }
  crearLocalidad(c: LocalidadEntrada): Observable<Respuesta<{ id: string }>> {
    return this.enviar('POST', '/admin/localidades', c);
  }
  actualizarLocalidad(id: string, c: LocalidadEntrada): Observable<Respuesta<null>> {
    return this.enviar('PUT', `/admin/localidades/${id}`, c);
  }

  // ---- comunidad ----
  colaComunidad(f: { tipo?: string | null; negocioId?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<ItemComunidad>> {
    const q = new URLSearchParams();
    if (f.tipo) q.set('tipo', f.tipo);
    if (f.negocioId) q.set('negocioId', f.negocioId);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/revision/comunidad/cola?' + q.toString());
  }
  accionComunidad(tipo: string, id: string, accion: AccionCola, motivo?: string): Observable<Respuesta<null>> {
    return this.enviar('POST', rutaAccion(tipo, id, accion), motivo === undefined ? undefined : { motivo });
  }

  // ---- usuarios y privacidad (solo administración) ----
  usuarios(f: { texto?: string | null; estado?: string | null; rol?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<UsuarioAdmin>> {
    const q = new URLSearchParams();
    if (f.texto?.trim()) q.set('texto', f.texto.trim());
    if (f.estado) q.set('estado', f.estado);
    if (f.rol) q.set('rol', f.rol);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/admin/usuarios?' + q.toString());
  }
  cambiarEstadoUsuario(id: string, estado: 'activo' | 'suspendido'): Observable<Respuesta<null>> {
    return this.enviar('PATCH', `/admin/usuarios/${id}/estado`, { estado });
  }
  asignarRol(id: string, rol: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/admin/usuarios/${id}/roles`, { rol });
  }
  quitarRol(id: string, rol: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/admin/usuarios/${id}/roles/${encodeURIComponent(rol)}`);
  }
  solicitudes(f: { estado?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<SolicitudPrivacidad>> {
    const q = new URLSearchParams();
    if (f.estado) q.set('estado', f.estado);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 20));
    return this.ver('/admin/solicitudes-privacidad?' + q.toString());
  }
  cambiarEstadoSolicitud(id: string, estado: string): Observable<Respuesta<SolicitudPrivacidad>> {
    return this.enviar('PATCH', `/admin/solicitudes-privacidad/${id}`, { estado });
  }

  // ---- ventas: prospectos ----
  prospectos(f: { estado?: string | null; asignadoA?: string | null; sinAsignar?: boolean; municipioId?: string | null; categoriaId?: string | null; origen?: string | null; vencidas?: boolean; q?: string | null; pagina?: number; tamano?: number } = {}): Observable<Pagina<ProspectoResumen>> {
    const q = new URLSearchParams();
    if (f.estado) q.set('estado', f.estado);
    if (f.asignadoA) q.set('asignadoA', f.asignadoA);
    if (f.sinAsignar) q.set('sinAsignar', 'true');
    if (f.municipioId) q.set('municipioId', f.municipioId);
    if (f.categoriaId) q.set('categoriaId', f.categoriaId);
    if (f.origen) q.set('origen', f.origen);
    if (f.vencidas) q.set('vencidas', 'true');
    if (f.q?.trim()) q.set('q', f.q.trim());
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 50));
    return this.ver('/admin/prospectos?' + q.toString());
  }
  resumenVentas(): Observable<ResumenVentas> {
    return this.ver('/admin/prospectos/resumen');
  }
  equipoVentas(): Observable<PersonaEquipo[]> {
    return this.ver('/admin/prospectos/equipo');
  }
  prospecto(id: string): Observable<ProspectoDetalle> {
    return this.ver(`/admin/prospectos/${id}`);
  }
  crearProspecto(c: ProspectoEntrada): Observable<Respuesta<ProspectoDetalle>> {
    return this.enviar('POST', '/admin/prospectos', c);
  }
  actualizarProspecto(id: string, c: ProspectoEntrada): Observable<Respuesta<ProspectoDetalle>> {
    return this.enviar('PUT', `/admin/prospectos/${id}`, c);
  }
  eliminarProspecto(id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/admin/prospectos/${id}`);
  }
  estadoProspecto(id: string, estado: string, motivo?: string | null): Observable<Respuesta<ProspectoDetalle>> {
    return this.enviar('POST', `/admin/prospectos/${id}/estado`, { estado, motivo: motivo ?? null });
  }
  interaccionProspecto(id: string, c: InteraccionEntrada): Observable<Respuesta<ProspectoDetalle>> {
    return this.enviar('POST', `/admin/prospectos/${id}/interacciones`, c);
  }
  convertirProspecto(id: string, categoriaId: string | null, municipioId: string | null): Observable<Respuesta<Conversion>> {
    return this.enviar('POST', `/admin/prospectos/${id}/convertir`, { categoriaId, municipioId });
  }

  // ---- ventas: importaciones ----
  importaciones(pagina = 0, tamano = 20): Observable<Pagina<Importacion>> {
    return this.ver(`/admin/importaciones?pagina=${pagina}&tamano=${tamano}`);
  }
  importacion(id: string): Observable<Importacion> {
    return this.ver(`/admin/importaciones/${id}`);
  }
  plantillaImportacion(tipo: string): Observable<Blob> {
    return this.http.get(this.base + `/admin/importaciones/plantilla/${tipo}`, { responseType: 'blob' }).pipe(timeout(15000));
  }
  erroresImportacion(id: string): Observable<Blob> {
    return this.http.get(this.base + `/admin/importaciones/${id}/errores.csv`, { responseType: 'blob' }).pipe(timeout(15000));
  }
  subirImportacion(tipo: string, archivo: File): Observable<Respuesta<Importacion>> {
    const f = new FormData();
    f.append('tipo', tipo);
    f.append('archivo', archivo, archivo.name);
    return this.http.post<Respuesta<Importacion>>(this.base + '/admin/importaciones', f).pipe(timeout(60000));
  }
  aplicarImportacion(id: string, soloCorrectas: boolean): Observable<Respuesta<Importacion>> {
    return this.enviar('POST', `/admin/importaciones/${id}/aplicar`, { soloCorrectas });
  }
  cancelarImportacion(id: string): Observable<Respuesta<Importacion>> {
    return this.enviar('POST', `/admin/importaciones/${id}/cancelar`);
  }

  // ---- ventas: afiliados ----
  afiliados(): Observable<Afiliado[]> {
    return this.ver('/admin/afiliados');
  }
  clicsAfiliado(id: string, desde: string, hasta: string): Observable<ClicDia[]> {
    return this.ver(`/admin/afiliados/${id}/clics?desde=${desde}&hasta=${hasta}`);
  }
  crearAfiliado(c: AfiliadoEntrada): Observable<Respuesta<Afiliado>> {
    return this.enviar('POST', '/admin/afiliados', c);
  }
  actualizarAfiliado(id: string, c: AfiliadoEntrada): Observable<Respuesta<Afiliado>> {
    return this.enviar('PUT', `/admin/afiliados/${id}`, c);
  }

  // ---- operación: patrocinios ----
  espacios(): Observable<Espacio[]> {
    return this.ver('/admin/espacios-patrocinio');
  }
  crearEspacio(e: EspacioEntrada): Observable<Respuesta<Espacio>> {
    return this.enviar('POST', '/admin/espacios-patrocinio', e);
  }
  actualizarEspacio(id: string, e: EspacioEntrada): Observable<Respuesta<Espacio>> {
    return this.enviar('PUT', `/admin/espacios-patrocinio/${id}`, e);
  }
  calendarioPatrocinios(f: { desde: string; hasta: string; espacioId?: string | null; soloVigentes: boolean }): Observable<Patrocinio[]> {
    const q = new URLSearchParams({ desde: f.desde, hasta: f.hasta, soloVigentes: String(f.soloVigentes) });
    if (f.espacioId) q.set('espacioId', f.espacioId);
    return this.ver('/admin/patrocinios/calendario?' + q.toString());
  }
  crearPatrocinio(p: PatrocinioEntrada): Observable<Respuesta<Patrocinio>> {
    return this.enviar('POST', '/admin/patrocinios', p);
  }
  cancelarPatrocinio(id: string): Observable<Respuesta<Patrocinio>> {
    return this.enviar('POST', `/admin/patrocinios/${id}/cancelar`);
  }

  // ---- operación: métricas y campañas ----
  metricas(f: { dias: number; regionId?: string | null; categoriaId?: string | null; limite?: number }): Observable<MetricasGenerales> {
    const q = new URLSearchParams({ dias: String(f.dias), limite: String(f.limite ?? 50) });
    if (f.regionId) q.set('regionId', f.regionId);
    if (f.categoriaId) q.set('categoriaId', f.categoriaId);
    return this.ver('/admin/metricas?' + q.toString());
  }
  origenes(): Observable<Origen[]> {
    return this.ver('/admin/origenes');
  }
  campanas(): Observable<Campana[]> {
    return this.ver('/admin/campanas');
  }
  crearCampana(c: CampanaEntrada): Observable<Respuesta<Campana>> {
    return this.enviar('POST', '/admin/campanas', c);
  }
  actualizarCampana(id: string, c: CampanaEntrada): Observable<Respuesta<Campana>> {
    return this.enviar('PUT', `/admin/campanas/${id}`, c);
  }

  // ---- operación: auditoría, configuración, plantillas, cola (solo administración) ----
  auditoria(f: { tabla?: string | null; accion?: string | null; usuarioId?: string | null; registroId?: string | null; desde?: string | null; hasta?: string | null; pagina?: number; tamano?: number }): Observable<Pagina<Auditoria>> {
    const q = new URLSearchParams();
    for (const k of ['tabla', 'accion', 'usuarioId', 'registroId', 'desde', 'hasta'] as const) { const v = f[k]?.trim(); if (v) q.set(k, v); }
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 50));
    return this.ver('/admin/auditoria?' + q.toString());
  }
  configuracion(): Observable<Configuracion[]> {
    return this.ver('/admin/configuracion');
  }
  cambiarConfiguracion(clave: string, valor: unknown): Observable<Respuesta<Configuracion>> {
    return this.enviar('PUT', `/admin/configuracion/${encodeURIComponent(clave)}`, { valor });
  }
  plantillas(): Observable<Plantilla[]> {
    return this.ver('/admin/plantillas');
  }
  editarPlantilla(id: string, p: PlantillaEdicion): Observable<Respuesta<Plantilla>> {
    return this.enviar('PUT', `/admin/plantillas/${id}`, p);
  }
  probarPlantilla(id: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/admin/plantillas/${id}/prueba`);
  }
  notificaciones(f: { estado?: string | null; plantilla?: string | null; pagina?: number; tamano?: number }): Observable<Pagina<Notificacion>> {
    const q = new URLSearchParams();
    if (f.estado) q.set('estado', f.estado);
    if (f.plantilla) q.set('plantilla', f.plantilla);
    q.set('pagina', String(f.pagina ?? 0));
    q.set('tamano', String(f.tamano ?? 50));
    return this.ver('/admin/notificaciones?' + q.toString());
  }
  reintentarNotificacion(id: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/admin/notificaciones/${id}/reintentar`);
  }
}
