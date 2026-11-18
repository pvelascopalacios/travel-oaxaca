import { HttpClient, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, forkJoin, map, of, switchMap, timeout } from 'rxjs';
import { API_URL } from './config';
import { Categoria, Contacto, Faltantes, Ficha, Idioma, IdiomaNivel, Invitacion, Localidad, MedioSubido, Metricas, Miembro, Municipio, NegocioResumen, Oferta, OfertaEntrada, Pago, PlanNegocio, PlanPublico, Promocion, PromocionEntrada, Suscripcion, ReporteMensual, Respuesta, RespuestaSesion, ResultadoCambio, Servicio, SubidaRespuesta, Traduccion } from './modelos';

export interface DatosNegocio {
  nombreComercial: string;
  razonSocial: string | null;
  categoriaId: string;
  rangoPrecio: number | null;
  precioDesde: number | null;
  unidadPrecio: string | null;
  atributos: Record<string, unknown>;
}
export interface DatosSucursal {
  nombre: string | null;
  esPrincipal?: boolean;
  municipioId: string;
  localidadId: string | null;
  direccionTexto: string | null;
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
}
export interface DatosContacto {
  tipo: string;
  valor: string;
  sucursalId?: string | null;
  esPrincipal: boolean;
}
export interface EntradaHorario {
  diaSemana: number;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}
export interface EntradaExcepcion {
  fecha: string;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
  nota: string | null;
}

/** Todas las llamadas del portal. Los errores llegan tal cual para leerlos con `leerError`. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  private ver<T>(ruta: string): Observable<T> {
    return this.http.get<Respuesta<T>>(this.base + ruta).pipe(timeout(12000), map((r) => r.datos));
  }

  private enviar<T>(metodo: 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Observable<Respuesta<T>> {
    return this.http.request<Respuesta<T>>(metodo, this.base + ruta, { body: cuerpo }).pipe(timeout(12000));
  }

  // ---- cuenta ----
  ingreso(cuerpo: { correo: string; clave: string }): Observable<Respuesta<RespuestaSesion>> {
    return this.enviar('POST', '/auth/ingreso', cuerpo);
  }
  registro(cuerpo: { correo: string; clave: string; nombre: string; aceptaTerminos: boolean }): Observable<Respuesta<RespuestaSesion>> {
    return this.enviar('POST', '/auth/registro', { ...cuerpo, idiomaCodigo: 'es' });
  }
  salir(tokenRenovacion: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/salir', { tokenRenovacion });
  }
  olvideClave(correo: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/olvide-clave', { correo });
  }
  restablecerClave(token: string, clave: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/restablecer-clave', { token, clave });
  }
  verificarCorreo(token: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/verificar-correo', { token });
  }
  reenviarVerificacion(correo: string): Observable<Respuesta<null>> {
    return this.enviar('POST', '/auth/reenviar-verificacion', { correo });
  }

  // ---- catálogos para registrar un negocio ----
  categorias(): Observable<Categoria[]> {
    return this.ver('/publico/categorias?idioma=es');
  }
  /**
   * Los municipios de Oaxaca (570) no caben en una sola llamada (la API da 300 como máximo), así que se piden por región.
   */
  municipios(): Observable<Municipio[]> {
    return this.ver<{ id: string }[]>('/publico/regiones').pipe(
      switchMap((regiones) =>
        regiones.length ? forkJoin(regiones.map((r) => this.ver<Municipio[]>(`/publico/municipios?regionId=${r.id}&limite=300`))) : of([] as Municipio[][]),
      ),
      map((grupos) => grupos.flat()),
    );
  }

  // ---- negocios ----
  misNegocios(): Observable<NegocioResumen[]> {
    return this.ver('/mi/negocios');
  }
  crearNegocio(cuerpo: { nombreComercial: string; categoriaId: string; municipioId: string }): Observable<Respuesta<Ficha>> {
    return this.enviar('POST', '/mi/negocios', cuerpo);
  }
  ficha(id: string): Observable<Ficha> {
    return this.ver('/negocios/' + id);
  }
  faltantes(id: string): Observable<Faltantes> {
    return this.ver(`/negocios/${id}/faltantes`);
  }
  enviarARevision(id: string): Observable<Respuesta<Ficha>> {
    return this.enviar('POST', `/negocios/${id}/enviar-revision`);
  }
  pausar(id: string): Observable<Respuesta<Ficha>> {
    return this.enviar('POST', `/negocios/${id}/pausar`);
  }
  reanudar(id: string): Observable<Respuesta<Ficha>> {
    return this.enviar('POST', `/negocios/${id}/reanudar`);
  }
  archivar(id: string): Observable<Respuesta<null>> {
    return this.enviar('POST', `/negocios/${id}/archivar`);
  }


  // ---- catálogos del editor ----
  servicios(): Observable<Servicio[]> {
    return this.ver('/publico/servicios?idioma=es');
  }
  idiomas(): Observable<Idioma[]> {
    return this.ver('/publico/idiomas');
  }
  localidades(municipioId: string): Observable<Localidad[]> {
    return this.ver(`/publico/municipios/${municipioId}/localidades`);
  }

  // ---- editor de la ficha: cada guardado responde si se aplicó o espera revisión ----
  actualizarNegocio(id: string, cuerpo: DatosNegocio): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}`, cuerpo);
  }
  guardarTraducciones(id: string, cuerpo: Record<string, Traduccion>): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/traducciones`, cuerpo);
  }
  guardarServicios(id: string, servicioIds: string[]): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/servicios`, { servicioIds });
  }
  guardarIdiomas(id: string, idiomas: IdiomaNivel[]): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/idiomas`, { idiomas });
  }
  crearSucursal(id: string, cuerpo: DatosSucursal): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('POST', `/negocios/${id}/sucursales`, cuerpo);
  }
  actualizarSucursal(id: string, sucursalId: string, cuerpo: DatosSucursal): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/sucursales/${sucursalId}`, cuerpo);
  }
  eliminarSucursal(id: string, sucursalId: string): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('DELETE', `/negocios/${id}/sucursales/${sucursalId}`);
  }
  guardarHorarios(id: string, sucursalId: string, horarios: EntradaHorario[]): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/sucursales/${sucursalId}/horarios`, { horarios });
  }
  guardarExcepciones(id: string, sucursalId: string, excepciones: EntradaExcepcion[]): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/sucursales/${sucursalId}/excepciones`, { excepciones });
  }
  crearContacto(id: string, cuerpo: DatosContacto): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('POST', `/negocios/${id}/contactos`, cuerpo);
  }
  actualizarContacto(id: string, contactoId: string, cuerpo: DatosContacto): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/contactos/${contactoId}`, cuerpo);
  }
  eliminarContacto(id: string, contactoId: string): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('DELETE', `/negocios/${id}/contactos/${contactoId}`);
  }

  // ---- fotos: pedir URL firmada → subir directo al almacén → confirmar → ligar a la ficha ----
  solicitarSubida(mime: string, bytes: number): Observable<Respuesta<SubidaRespuesta>> {
    return this.enviar('POST', '/mi/medios/subida', { mime, bytes });
  }
  /** Sube el archivo a la URL firmada. Emite el avance (0–100) y termina cuando el almacén responde. No lleva nuestro token. */
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
  agregarMedio(id: string, medioId: string, pieTexto: string | null): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('POST', `/negocios/${id}/medios`, { medioId, pieTexto });
  }
  quitarMedio(id: string, medioId: string): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('DELETE', `/negocios/${id}/medios/${medioId}`);
  }
  ordenarMedios(id: string, orden: string[], portadaId: string | null): Observable<Respuesta<ResultadoCambio>> {
    return this.enviar('PUT', `/negocios/${id}/medios/orden`, { orden, portadaId });
  }

  // ---- opciones: habitaciones, tours, platillos, productos ----
  plan(id: string): Observable<PlanNegocio> {
    return this.ver(`/negocios/${id}/plan`);
  }
  ofertas(id: string): Observable<Oferta[]> {
    return this.ver(`/negocios/${id}/ofertas`);
  }
  crearOferta(id: string, cuerpo: OfertaEntrada): Observable<Respuesta<Oferta>> {
    return this.enviar('POST', `/negocios/${id}/ofertas`, cuerpo);
  }
  actualizarOferta(id: string, ofertaId: string, cuerpo: OfertaEntrada): Observable<Respuesta<Oferta>> {
    return this.enviar('PUT', `/negocios/${id}/ofertas/${ofertaId}`, cuerpo);
  }
  estadoOferta(id: string, ofertaId: string, estado: string): Observable<Respuesta<Oferta>> {
    return this.enviar('PUT', `/negocios/${id}/ofertas/${ofertaId}/estado`, { estado });
  }
  eliminarOferta(id: string, ofertaId: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/negocios/${id}/ofertas/${ofertaId}`);
  }

  // ---- promociones ----
  promociones(id: string): Observable<Promocion[]> {
    return this.ver(`/negocios/${id}/promociones`);
  }
  crearPromocion(id: string, cuerpo: PromocionEntrada): Observable<Respuesta<Promocion>> {
    return this.enviar('POST', `/negocios/${id}/promociones`, cuerpo);
  }
  actualizarPromocion(id: string, promoId: string, cuerpo: PromocionEntrada): Observable<Respuesta<Promocion>> {
    return this.enviar('PUT', `/negocios/${id}/promociones/${promoId}`, cuerpo);
  }
  enviarPromocion(id: string, promoId: string): Observable<Respuesta<Promocion>> {
    return this.enviar('POST', `/negocios/${id}/promociones/${promoId}/enviar-revision`);
  }
  eliminarPromocion(id: string, promoId: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/negocios/${id}/promociones/${promoId}`);
  }

  // ---- plan y pagos (solo lectura) ----
  suscripciones(id: string): Observable<Suscripcion[]> {
    return this.ver(`/negocios/${id}/suscripciones`);
  }
  pagos(id: string): Observable<Pago[]> {
    return this.ver(`/negocios/${id}/pagos`);
  }
  planesPublicos(): Observable<PlanPublico[]> {
    return this.ver('/publico/planes');
  }

  // ---- equipo e invitaciones ----
  miembros(id: string): Observable<Miembro[]> {
    return this.ver(`/negocios/${id}/miembros`);
  }
  invitar(id: string, correo: string): Observable<Respuesta<Miembro[]>> {
    return this.enviar('POST', `/negocios/${id}/invitaciones`, { correo });
  }
  revocar(id: string, usuarioId: string): Observable<Respuesta<Miembro[]>> {
    return this.enviar('DELETE', `/negocios/${id}/miembros/${usuarioId}`);
  }
  misInvitaciones(): Observable<Invitacion[]> {
    return this.ver('/mi/invitaciones');
  }
  responderInvitacion(id: string, acepta: boolean): Observable<Respuesta<null>> {
    return this.enviar('POST', `/mi/invitaciones/${id}/responder`, { acepta });
  }

  // ---- resultados ----
  /** Sin `dias` la API elige el periodo (30, o el que permita el plan Gratis). Pedir otro en plan Gratis da 403. */
  metricas(id: string, dias?: number): Observable<Metricas> {
    return this.ver(`/negocios/${id}/metricas` + (dias ? `?dias=${dias}` : ''));
  }
  reportes(id: string): Observable<ReporteMensual[]> {
    return this.ver(`/negocios/${id}/reportes`);
  }
}
