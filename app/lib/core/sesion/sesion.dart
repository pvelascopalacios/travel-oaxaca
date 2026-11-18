import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/cliente.dart';
import '../api/respuesta.dart';
import 'modelos.dart';

/// El usuario con sesión iniciada, o null si navega sin cuenta.
final sesionProvider = AsyncNotifierProvider<SesionNotifier, Usuario?>(SesionNotifier.new);

class SesionNotifier extends AsyncNotifier<Usuario?> {
  @override
  Future<Usuario?> build() async {
    final almacen = ref.read(almacenProvider);
    final tokens = await almacen.leerTokens();
    if (tokens == null) return null;
    return almacen.leerUsuario();
  }

  Dio get _dio => ref.read(dioProvider);

  Future<void> ingresar(String correo, String clave) async {
    final r = await _llamar('/auth/ingreso', {'correo': correo.trim(), 'clave': clave});
    await _guardarSesion(r);
  }

  Future<void> registrar({
    required String nombre,
    required String correo,
    required String clave,
    required bool aceptaTerminos,
  }) async {
    final r = await _llamar('/auth/registro', {
      'nombre': nombre.trim(),
      'correo': correo.trim(),
      'clave': clave,
      'idiomaCodigo': 'es',
      'aceptaTerminos': aceptaTerminos,
    });
    await _guardarSesion(r);
  }

  /// Pide el enlace para restablecer la contraseña. La API responde igual exista o no el correo.
  Future<String> olvideClave(String correo) async {
    final r = await _llamar('/auth/olvide-clave', {'correo': correo.trim()});
    return r.mensajes.isNotEmpty ? r.mensajes.first : 'Si el correo existe, te enviamos un enlace para elegir una contraseña nueva.';
  }

  /// Vuelve a leer mi perfil en la API (por ejemplo, si ya confirmé el correo desde otro dispositivo).
  Future<void> refrescarPerfil() async {
    if (state.valueOrNull == null) return;
    try {
      final r = await _dio.get<dynamic>('/mi/perfil');
      final api = ApiRespuesta.desdeJson(r.data);
      final d = api.datos;
      if (!api.ok || d is! Map) return;
      await aplicarUsuario(Usuario.desdeJson(Map<String, dynamic>.from(d)));
    } catch (_) {
      // Sin conexión: se queda con lo que ya teníamos.
    }
  }

  /// Guarda el usuario actualizado (nombre, idioma, correo verificado) en el teléfono y en pantalla.
  Future<void> aplicarUsuario(Usuario usuario) async {
    await ref.read(almacenProvider).guardarUsuario(usuario);
    state = AsyncData(usuario);
  }

  Future<void> salir() async {
    try {
      await _dio.post<dynamic>('/auth/salir');
    } catch (_) {
      // Aunque la API no responda, la sesión se cierra en el teléfono.
    }
    await ref.read(almacenProvider).borrar();
    state = const AsyncData(null);
  }

  /// La renovación falló: la sesión ya no sirve.
  Future<void> expirada() async {
    await ref.read(almacenProvider).borrar();
    state = const AsyncData(null);
  }

  Future<ApiRespuesta> _llamar(String ruta, Map<String, dynamic> cuerpo) async {
    try {
      final r = await _dio.post<dynamic>(ruta, data: cuerpo);
      final api = ApiRespuesta.desdeJson(r.data);
      if (!api.ok) {
        throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : 'No se pudo completar.', campos: api.errores);
      }
      return api;
    } on DioException catch (e) {
      throw ErrorApi.desde(e);
    }
  }

  Future<void> _guardarSesion(ApiRespuesta api) async {
    final d = api.datos;
    if (d is! Map) throw const ErrorApi('La respuesta del servidor no se entiende.');
    final usuario = Usuario.desdeJson(Map<String, dynamic>.from(d['usuario'] as Map));
    final almacen = ref.read(almacenProvider);
    await almacen.guardarTokens(Tokens(
      acceso: (d['tokenAcceso'] ?? '').toString(),
      renovacion: (d['tokenRenovacion'] ?? '').toString(),
    ));
    await almacen.guardarUsuario(usuario);
    state = AsyncData(usuario);
  }
}
