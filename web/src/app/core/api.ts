import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, forkJoin, map, of, timeout, toArray } from 'rxjs';
import { API_URL } from './config';
import {
  BusquedaGlobal, Categoria, EventoPublico, EventoTarjeta, Facetas, InicioEditorial, LugarPublico, LugarTarjeta, NegocioPublico, NegocioTarjeta, Pagina, PuntoMapa, Region,
  Comentario, Consentimiento, ElementoEdicion, ElementoEntrada, Favorito, ListaDetalle, ListaEntrada, ListaResumen, Reaccion, ResenaPropia, SeccionComentarios, MiNegocio, MiResena, MunicipioOpcion, SolicitudContacto, Perfil, PlanPublico, SesionActiva, SolicitudPrivacidad, TipoConsentimiento, TipoSolicitud, ReporteMensual, RespuestaSesion, Respuesta, ResenasPublicas, RutaPublica, RutaTarjeta, Servicio, TipoFavorito,
} from './modelos';
import { I18n } from './i18n';

type Parametros = Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>;

/** Cliente de la API pública. Siempre pide el texto en el idioma activo; la API responde en español si falta. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  private readonly i18n = inject(I18n);

  private get<T>(ruta: string, parametros: Parametros = {}): Observable<T> {
    let p = new HttpParams().set('idioma', this.i18n.lang());
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor === null || valor === undefined || valor === '') continue;
      // La web cuenta las páginas desde 1; la API, desde 0. Sin esto la primera página se salta los primeros resultados.
      if (clave === 'pagina') { p = p.set(clave, String(Math.max(0, Number(valor) - 1))); continue; }
      p = Array.isArray(valor) ? valor.reduce((acc, v) => acc.append(clave, String(v)), p) : p.set(clave, String(valor));
    }
    return this.http.get<Respuesta<T>>(this.base + ruta, { params: p }).pipe(
      // Si la API no responde, la pantalla muestra su aviso en lugar de quedarse esperando.
      timeout(6000),
      map((r) => r.datos),
    );
  }

  buscar(q: string, tamano = 4): Observable<BusquedaGlobal> {
    return this.get('/publico/buscar', { q, tamano });
  }

  facetas(parametros: Parametros = {}): Observable<Facetas> {
    return this.get('/publico/negocios/facetas', parametros);
  }

  negocios(parametros: Parametros = {}): Observable<Pagina<NegocioTarjeta>> {
    return this.get('/publico/negocios', parametros);
  }

  lugares(parametros: Parametros = {}): Observable<Pagina<LugarTarjeta>> {
    return this.get('/publico/lugares', parametros);
  }

  eventos(parametros: Parametros = {}): Observable<Pagina<EventoTarjeta>> {
    return this.get('/publico/eventos', parametros);
  }

  mapa(parametros: Parametros = {}): Observable<PuntoMapa[]> {
    return this.get('/publico/negocios/mapa', parametros);
  }

  categorias(): Observable<Categoria[]> {
    return this.get('/publico/categorias');
  }

  municipios(q: string): Observable<MunicipioOpcion[]> {
    return this.get('/publico/municipios', { q, limite: 15 });
  }

  /** «Quiero que me contacten»: un dueño de negocio deja sus datos sin crear cuenta. */
  solicitarContacto(cuerpo: SolicitudContacto): Observable<Respuesta<null>> {
    return this.enviar('POST', '/publico/prospectos', cuerpo);
  }

  planes(): Observable<PlanPublico[]> {
    return this.get('/publico/planes');
  }

  servicios(): Observable<Servicio[]> {
    return this.get('/publico/servicios');
  }

  rutas(parametros: Parametros = {}): Observable<Pagina<RutaTarjeta>> {
    return this.get('/publico/rutas', parametros);
  }

  regiones(): Observable<Region[]> {
    return this.get('/publico/regiones/conteos');
  }

  /** Destacados, pueblos, historias y Reels que el equipo publica desde el panel. */
  inicio(): Observable<InicioEditorial> {
    return this.get('/publico/inicio');
  }

  negocio(slug: string): Observable<NegocioPublico> {
    return this.get('/publico/negocios/' + encodeURIComponent(slug));
  }

  lugar(slug: string): Observable<LugarPublico> {
    return this.get('/publico/lugares/' + encodeURIComponent(slug));
  }

  evento(slug: string): Observable<EventoPublico> {
    return this.get('/publico/eventos/' + encodeURIComponent(slug));
  }

  ruta(slug: string): Observable<RutaPublica> {
    return this.get('/publico/rutas/' + encodeURIComponent(slug));
  }

  resenas(slug: string, parametros: Parametros = {}): Observable<ResenasPublicas> {
    return this.get('/publico/negocios/' + encodeURIComponent(slug) + '/resenas', parametros);
  }

  // ---------------- cuentas (no llevan idioma ni caché; las respuestas completas traen los mensajes de la API) ----------------

  private enviar<T>(metodo: 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Observable<Respuesta<T>> {
    return this.http.request<Respuesta<T>>(metodo, this.base + ruta, { body: cuerpo }).pipe(timeout(10000));
  }

  registro(cuerpo: { correo: string; clave: string; nombre: string; aceptaTerminos: boolean; dispositivoId?: string | null }): Observable<Respuesta<RespuestaSesion>> {
    return this.enviar('POST', '/auth/registro', { ...cuerpo, idiomaCodigo: this.i18n.lang() });
  }

  ingreso(cuerpo: { correo: string; clave: string; dispositivoId?: string | null }): Observable<Respuesta<RespuestaSesion>> {
    return this.enviar('POST', '/auth/ingreso', cuerpo);
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

  favoritos(): Observable<Favorito[]> {
    return this.http.get<Respuesta<Favorito[]>>(this.base + '/mi/favoritos').pipe(timeout(10000), map((r) => r.datos));
  }

  guardarFavorito(tipo: TipoFavorito, id: string): Observable<Respuesta<unknown>> {
    return this.enviar('PUT', '/mi/favoritos', { tipo, id });
  }

  quitarFavorito(tipo: TipoFavorito, id: string): Observable<Respuesta<unknown>> {
    return this.enviar('DELETE', `/mi/favoritos/${tipo}/${id}`);
  }

  miResena(negocioId: string): Observable<MiResena> {
    return this.http.get<Respuesta<MiResena>>(`${this.base}/mi/negocios/${negocioId}/resena`).pipe(timeout(10000), map((r) => r.datos));
  }

  crearResena(negocioId: string, cuerpo: ResenaEntrada): Observable<Respuesta<MiResena>> {
    return this.enviar('POST', `/mi/negocios/${negocioId}/resena`, cuerpo);
  }

  editarResena(id: string, cuerpo: ResenaEntrada): Observable<Respuesta<MiResena>> {
    return this.enviar('PUT', `/mi/resenas/${id}`, cuerpo);
  }

  borrarResena(id: string): Observable<Respuesta<unknown>> {
    return this.enviar('DELETE', `/mi/resenas/${id}`);
  }

  // ---------------- perfil ----------------

  perfil(): Observable<Perfil> {
    return this.http.get<Respuesta<Perfil>>(this.base + '/mi/perfil').pipe(timeout(10000), map((r) => r.datos));
  }

  guardarPerfil(cuerpo: { nombre: string; telefonoE164: string | null; idiomaCodigo: string | null }): Observable<Respuesta<Perfil>> {
    return this.enviar('PUT', '/mi/perfil', cuerpo);
  }

  cambiarClave(claveActual: string, claveNueva: string): Observable<Respuesta<null>> {
    return this.enviar('PUT', '/mi/clave', { claveActual, claveNueva });
  }

  sesiones(): Observable<SesionActiva[]> {
    return this.http.get<Respuesta<SesionActiva[]>>(this.base + '/mi/sesiones').pipe(timeout(10000), map((r) => r.datos));
  }

  cerrarSesion(id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/mi/sesiones/${id}`);
  }

  /** Cierra varias sesiones a la vez; si no hay ninguna, no hace nada. */
  cerrarSesiones(ids: string[]): Observable<unknown> {
    return ids.length ? forkJoin(ids.map((id) => this.cerrarSesion(id))) : of(null);
  }

  consentimientos(): Observable<Consentimiento[]> {
    return this.http.get<Respuesta<Consentimiento[]>>(this.base + '/mi/consentimientos').pipe(timeout(10000), map((r) => r.datos));
  }

  registrarConsentimiento(tipo: TipoConsentimiento, aceptado: boolean): Observable<Respuesta<null>> {
    return this.enviar('POST', '/mi/consentimientos', { tipo, aceptado, versionTexto: '1' });
  }

  solicitudes(): Observable<SolicitudPrivacidad[]> {
    return this.http.get<Respuesta<SolicitudPrivacidad[]>>(this.base + '/mi/solicitudes-privacidad').pipe(timeout(10000), map((r) => r.datos));
  }

  crearSolicitud(tipo: TipoSolicitud, detalle: string | null): Observable<Respuesta<SolicitudPrivacidad>> {
    return this.enviar('POST', '/mi/solicitudes-privacidad', { tipo, detalle });
  }

  // ---------------- listas e itinerarios ----------------

  listas(): Observable<ListaResumen[]> {
    return this.http.get<Respuesta<ListaResumen[]>>(this.base + '/mi/listas').pipe(timeout(10000), map((r) => r.datos));
  }

  crearLista(cuerpo: ListaEntrada): Observable<Respuesta<ListaResumen>> {
    return this.enviar('POST', '/mi/listas', cuerpo);
  }

  editarLista(id: string, cuerpo: ListaEntrada): Observable<Respuesta<ListaResumen>> {
    return this.enviar('PUT', `/mi/listas/${id}`, cuerpo);
  }

  borrarLista(id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/mi/listas/${id}`);
  }

  /** Una de mis listas con sus elementos, en el idioma activo. */
  miLista(id: string): Observable<ListaDetalle> {
    return this.get(`/mi/listas/${id}`);
  }

  /** Una lista pública, para quien recibe el enlace. */
  listaPublica(id: string): Observable<ListaDetalle> {
    return this.get(`/publico/listas/${id}`);
  }

  agregarALista(id: string, cuerpo: ElementoEntrada): Observable<Respuesta<ListaDetalle>> {
    return this.enviar('POST', `/mi/listas/${id}/elementos`, cuerpo);
  }

  editarElemento(id: string, itemId: string, cuerpo: ElementoEdicion): Observable<Respuesta<ListaDetalle>> {
    return this.enviar('PUT', `/mi/listas/${id}/elementos/${itemId}`, cuerpo);
  }

  quitarElemento(id: string, itemId: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/mi/listas/${id}/elementos/${itemId}`);
  }

  /** Aplica varios cambios de elemento en orden (uno después de otro) y termina cuando todos acabaron. */
  editarElementos(id: string, cambios: { itemId: string; cuerpo: ElementoEdicion }[]): Observable<unknown> {
    return cambios.length ? concat(...cambios.map((c) => this.editarElemento(id, c.itemId, c.cuerpo))).pipe(toArray()) : of(null);
  }

  misResenas(): Observable<ResenaPropia[]> {
    return this.http.get<Respuesta<ResenaPropia[]>>(this.base + '/mi/resenas').pipe(timeout(10000), map((r) => r.datos));
  }

  // ---------------- comentarios, reacciones y reportes ----------------

  comentarios(seccion: SeccionComentarios, slug: string, parametros: Parametros = {}): Observable<Pagina<Comentario>> {
    return this.get(`/publico/${seccion}/${encodeURIComponent(slug)}/comentarios`, parametros);
  }

  comentar(seccion: SeccionComentarios, id: string, texto: string, padreId: string | null): Observable<Respuesta<Comentario>> {
    return this.enviar('POST', `/mi/${seccion}/${id}/comentarios`, { texto, padreId, idioma: this.i18n.lang() });
  }

  editarComentario(id: string, texto: string): Observable<Respuesta<Comentario>> {
    return this.enviar('PUT', `/mi/comentarios/${id}`, { texto });
  }

  borrarComentario(id: string): Observable<Respuesta<null>> {
    return this.enviar('DELETE', `/mi/comentarios/${id}`);
  }

  /** «Me gusta» a un comentario o «útil» a una reseña (objetivo: comentario | resena). Es idempotente. */
  reaccionar(objetivo: 'comentario' | 'resena', id: string): Observable<Respuesta<Reaccion>> {
    return this.enviar('PUT', `/mi/reacciones/${objetivo}/${id}`);
  }

  quitarReaccion(objetivo: 'comentario' | 'resena', id: string): Observable<Respuesta<Reaccion>> {
    return this.enviar('DELETE', `/mi/reacciones/${objetivo}/${id}`);
  }

  reportarContenido(tipo: 'resena' | 'comentario' | 'foto', id: string, motivo: string, detalle: string | null): Observable<Respuesta<null>> {
    return this.enviar('POST', '/publico/reportes/contenido', { tipo, id, motivo, detalle });
  }

  reportarFicha(negocioId: string, motivo: string, detalle: string | null): Observable<Respuesta<null>> {
    return this.enviar('POST', '/publico/reportes/ficha', { negocioId, motivo, detalle });
  }

  misNegocios(): Observable<MiNegocio[]> {
    return this.http.get<Respuesta<MiNegocio[]>>(this.base + '/mi/negocios').pipe(timeout(10000), map((r) => r.datos));
  }

  reportes(negocioId: string): Observable<ReporteMensual[]> {
    return this.http.get<Respuesta<ReporteMensual[]>>(`${this.base}/negocios/${negocioId}/reportes`).pipe(timeout(10000), map((r) => r.datos));
  }
}

export interface ResenaEntrada {
  calificacion: number;
  titulo: string | null;
  texto: string | null;
  fechaVisita: string | null;
  idioma: string;
}
