import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../sesion/almacen.dart';
import '../sesion/modelos.dart';
import '../sesion/sesion.dart';
import 'respuesta.dart';

final almacenProvider = Provider<AlmacenSesion>((ref) => AlmacenSesion());

/// Cliente HTTP único de la app: pone el token en cada petición y, si la API
/// responde 401, renueva la sesión una vez y repite la petición.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: Config.apiUrl,
    connectTimeout: const Duration(seconds: 12),
    receiveTimeout: const Duration(seconds: 25),
    headers: {'Accept': 'application/json'},
  ));
  dio.interceptors.add(_InterceptorSesion(ref, dio));
  return dio;
});

class _InterceptorSesion extends Interceptor {
  _InterceptorSesion(this._ref, this._dio);

  final Ref _ref;
  final Dio _dio;
  Future<Tokens?>? _renovando;

  static const _marcaReintento = 'reintentado';

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Las rutas de acceso (ingreso, registro…) van sin token.
    if (!options.path.startsWith('/auth/') || options.path == '/auth/salir') {
      final t = await _ref.read(almacenProvider).leerTokens();
      if (t != null) options.headers['Authorization'] = 'Bearer ${t.acceso}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final req = err.requestOptions;
    final es401 = err.response?.statusCode == 401;
    final esAuth = req.path.startsWith('/auth/');
    if (!es401 || esAuth || req.extra[_marcaReintento] == true) {
      handler.next(err);
      return;
    }
    final nuevos = await (_renovando ??= _renovar().whenComplete(() => _renovando = null));
    if (nuevos == null) {
      await _ref.read(sesionProvider.notifier).expirada();
      handler.next(err);
      return;
    }
    try {
      req.extra[_marcaReintento] = true;
      req.headers['Authorization'] = 'Bearer ${nuevos.acceso}';
      final respuesta = await _dio.fetch<dynamic>(req);
      handler.resolve(respuesta);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Cambia el token de renovación por tokens nuevos. Devuelve null si ya no sirve.
  Future<Tokens?> _renovar() async {
    final almacen = _ref.read(almacenProvider);
    final actuales = await almacen.leerTokens();
    if (actuales == null) return null;
    try {
      final limpio = Dio(BaseOptions(baseUrl: Config.apiUrl, connectTimeout: const Duration(seconds: 12)));
      final r = await limpio.post<dynamic>('/auth/renovar', data: {'tokenRenovacion': actuales.renovacion});
      final api = ApiRespuesta.desdeJson(r.data);
      final d = api.datos;
      if (!api.ok || d is! Map) return null;
      final nuevos = Tokens(
        acceso: (d['tokenAcceso'] ?? '').toString(),
        renovacion: (d['tokenRenovacion'] ?? '').toString(),
      );
      if (nuevos.acceso.isEmpty || nuevos.renovacion.isEmpty) return null;
      await almacen.guardarTokens(nuevos);
      return nuevos;
    } catch (_) {
      return null;
    }
  }
}
