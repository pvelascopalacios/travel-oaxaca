import 'package:dio/dio.dart';

/// Formato único de toda la API: { ok, datos, mensajes, errores }.
class ApiRespuesta {
  const ApiRespuesta({
    required this.ok,
    this.datos,
    this.mensajes = const [],
    this.errores = const {},
  });

  final bool ok;
  final dynamic datos;
  final List<String> mensajes;
  final Map<String, String> errores;

  factory ApiRespuesta.desdeJson(dynamic json) {
    if (json is! Map) {
      return const ApiRespuesta(ok: false, mensajes: ['La respuesta del servidor no se entiende.']);
    }
    final mensajes = <String>[];
    final crudos = json['mensajes'];
    if (crudos is List) {
      for (final m in crudos) {
        if (m != null) mensajes.add(m.toString());
      }
    }
    final errores = <String, String>{};
    final crudosErr = json['errores'];
    if (crudosErr is Map) {
      crudosErr.forEach((k, v) {
        if (k != null && v != null) errores[k.toString()] = v.toString();
      });
    }
    return ApiRespuesta(
      ok: json['ok'] == true,
      datos: json['datos'],
      mensajes: mensajes,
      errores: errores,
    );
  }
}

/// Un error listo para mostrar: texto general y, si aplica, un texto por campo.
class ErrorApi implements Exception {
  const ErrorApi(this.general, {this.campos = const {}, this.codigo});

  final String general;
  final Map<String, String> campos;
  final int? codigo;

  static const String _sinConexion = 'No pudimos conectar con el servidor. Revisa tu internet e inténtalo de nuevo.';
  static const String _generico = 'Algo salió mal. Inténtalo de nuevo.';

  /// Convierte cualquier error (Dio, otro) en un [ErrorApi].
  factory ErrorApi.desde(Object error) {
    if (error is ErrorApi) return error;
    if (error is DioException) {
      final r = error.response;
      if (r != null) {
        final api = ApiRespuesta.desdeJson(r.data);
        final general = api.mensajes.isNotEmpty ? api.mensajes.first : _porCodigo(r.statusCode);
        return ErrorApi(general, campos: api.errores, codigo: r.statusCode);
      }
      return const ErrorApi(_sinConexion);
    }
    return const ErrorApi(_generico);
  }

  static String _porCodigo(int? codigo) {
    switch (codigo) {
      case 401:
        return 'Tu sesión terminó. Vuelve a ingresar.';
      case 403:
        return 'No tienes permiso para hacer esto.';
      case 404:
        return 'No encontramos lo que buscas.';
      case 429:
        return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
      default:
        return _generico;
    }
  }

  @override
  String toString() => 'ErrorApi($general)';
}
