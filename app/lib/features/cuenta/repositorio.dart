import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cliente.dart';
import '../../core/api/respuesta.dart';
import 'modelos.dart';

/// Mi cuenta: perfil, contraseña, sesiones, consentimientos y solicitudes de privacidad.
class RepositorioCuenta {
  RepositorioCuenta(this._dio);
  final Dio _dio;

  Future<ApiRespuesta> _ok(Future<Response<dynamic>> Function() llamada, String falla) async {
    try {
      final api = ApiRespuesta.desdeJson((await llamada()).data);
      if (!api.ok) throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : falla, campos: api.errores);
      return api;
    } on DioException catch (e) {
      throw ErrorApi.desde(e);
    }
  }

  List<Map<String, dynamic>> _lista(dynamic d) =>
      d is List ? d.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];

  Future<PerfilCuenta> perfil() async {
    final api = await _ok(() => _dio.get('/mi/perfil'), 'No pudimos cargar tu perfil.');
    return PerfilCuenta.desdeJson(Map<String, dynamic>.from(api.datos as Map));
  }

  Future<PerfilCuenta> guardarPerfil({required String nombre, String? telefonoE164, required String idiomaCodigo}) async {
    final api = await _ok(
      () => _dio.put('/mi/perfil', data: {'nombre': nombre.trim(), 'telefonoE164': telefonoE164, 'idiomaCodigo': idiomaCodigo}),
      'No pudimos guardar tus datos.',
    );
    return PerfilCuenta.desdeJson(Map<String, dynamic>.from(api.datos as Map));
  }

  Future<void> cambiarClave(String actual, String nueva) async {
    await _ok(() => _dio.put('/mi/clave', data: {'claveActual': actual, 'claveNueva': nueva}), 'No pudimos cambiar la contraseña.');
  }

  Future<List<SesionActiva>> sesiones() async {
    final api = await _ok(() => _dio.get('/mi/sesiones'), 'No pudimos cargar tus sesiones.');
    return _lista(api.datos).map(SesionActiva.desdeJson).toList();
  }

  Future<void> cerrarSesion(String id) async {
    await _ok(() => _dio.delete('/mi/sesiones/$id'), 'No pudimos cerrar esa sesión.');
  }

  Future<List<Consentimiento>> consentimientos() async {
    final api = await _ok(() => _dio.get('/mi/consentimientos'), 'No pudimos cargar tus preferencias.');
    return _lista(api.datos).map(Consentimiento.desdeJson).toList();
  }

  Future<void> registrarConsentimiento(String tipo, bool aceptado) async {
    await _ok(() => _dio.post('/mi/consentimientos', data: {'tipo': tipo, 'aceptado': aceptado}), 'No pudimos guardar tu preferencia.');
  }

  Future<List<SolicitudPrivacidad>> solicitudes() async {
    final api = await _ok(() => _dio.get('/mi/solicitudes-privacidad'), 'No pudimos cargar tus solicitudes.');
    return _lista(api.datos).map(SolicitudPrivacidad.desdeJson).toList();
  }

  Future<String> crearSolicitud(String tipo, String? detalle) async {
    final api = await _ok(
      () => _dio.post('/mi/solicitudes-privacidad', data: {'tipo': tipo, 'detalle': (detalle ?? '').trim().isEmpty ? null : detalle!.trim()}),
      'No pudimos enviar tu solicitud.',
    );
    return api.mensajes.isNotEmpty ? api.mensajes.first : 'Recibimos tu solicitud.';
  }

  Future<List<IdiomaApp>> idiomas() async {
    final api = await _ok(() => _dio.get('/idiomas'), 'No pudimos cargar los idiomas.');
    return _lista(api.datos).map(IdiomaApp.desdeJson).toList();
  }

  /// Vuelve a mandar el correo de confirmación.
  Future<String> reenviarVerificacion(String correo) async {
    final api = await _ok(() => _dio.post('/auth/reenviar-verificacion', data: {'correo': correo}), 'No pudimos enviar el correo.');
    return api.mensajes.isNotEmpty ? api.mensajes.first : 'Te enviamos el correo de confirmación.';
  }
}

final repositorioCuentaProvider = Provider<RepositorioCuenta>((ref) => RepositorioCuenta(ref.watch(dioProvider)));

final perfilCuentaProvider = FutureProvider.autoDispose<PerfilCuenta>((ref) => ref.watch(repositorioCuentaProvider).perfil());
final sesionesProvider = FutureProvider.autoDispose<List<SesionActiva>>((ref) => ref.watch(repositorioCuentaProvider).sesiones());
final consentimientosProvider =
    FutureProvider.autoDispose<List<Consentimiento>>((ref) => ref.watch(repositorioCuentaProvider).consentimientos());
final solicitudesProvider =
    FutureProvider.autoDispose<List<SolicitudPrivacidad>>((ref) => ref.watch(repositorioCuentaProvider).solicitudes());
final idiomasProvider = FutureProvider<List<IdiomaApp>>((ref) => ref.watch(repositorioCuentaProvider).idiomas());
