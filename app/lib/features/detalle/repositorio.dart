import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cliente.dart';
import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import 'modelos.dart';

class RepositorioDetalle {
  RepositorioDetalle(this._dio);
  final Dio _dio;

  Future<dynamic> _leer(String ruta, [Map<String, dynamic>? consulta]) async {
    final r = await _dio.get(ruta, queryParameters: consulta);
    final api = ApiRespuesta.desdeJson(r.data);
    if (!api.ok) {
      throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : 'Algo salió mal. Inténtalo de nuevo.');
    }
    return api.datos;
  }

  Future<NegocioDetalle> negocio(String slug) async {
    final d = await _leer('/publico/negocios/$slug');
    return NegocioDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Future<LugarDetalle> lugar(String slug) async {
    final d = await _leer('/publico/lugares/$slug');
    return LugarDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Future<EventoDetalle> evento(String slug) async {
    final d = await _leer('/publico/eventos/$slug');
    return EventoDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Future<ResenasPublicas> resenas(String slug) async {
    final d = await _leer('/publico/negocios/$slug/resenas', {'tamano': 5});
    return ResenasPublicas.desdeJson(d);
  }

  Future<List<Favorito>> favoritos() async {
    final d = await _leer('/mi/favoritos');
    final lista = d is List ? d : const [];
    return lista.whereType<Map>().map((e) => Favorito.desdeJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Mi reseña de un negocio, o null si todavía no lo reseño.
  Future<ResenaPropia?> miResena(String negocioId) async {
    try {
      final d = await _leer('/mi/negocios/$negocioId/resena');
      return d is Map ? ResenaPropia.desdeJson(Map<String, dynamic>.from(d)) : null;
    } catch (e) {
      if (ErrorApi.desde(e).codigo == 404) return null;
      rethrow;
    }
  }

  Future<List<MiResena>> misResenas() async {
    final d = await _leer('/mi/resenas');
    final lista = d is List ? d : const [];
    return lista.whereType<Map>().map((e) => MiResena.desdeJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Crea la reseña (o la edita si ya existe [resenaId]). Devuelve el mensaje de la API
  /// ("¡Gracias! Tu reseña ya es visible." o "La revisaremos antes de publicarla.").
  Future<String> guardarResena({
    required String negocioId,
    String? resenaId,
    required int calificacion,
    String? titulo,
    required String texto,
    DateTime? fechaVisita,
  }) async {
    final cuerpo = <String, dynamic>{
      'calificacion': calificacion,
      'titulo': (titulo ?? '').trim().isEmpty ? null : titulo!.trim(),
      'texto': texto.trim(),
      'fechaVisita': fechaVisita == null ? null : fechaVisita.toIso8601String().substring(0, 10),
      'idioma': 'es',
    };
    final r = resenaId == null
        ? await _dio.post('/mi/negocios/$negocioId/resena', data: cuerpo)
        : await _dio.put('/mi/resenas/$resenaId', data: cuerpo);
    final api = ApiRespuesta.desdeJson(r.data);
    if (!api.ok) {
      throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : 'No pudimos guardar tu reseña.', campos: api.errores);
    }
    return api.mensajes.isNotEmpty ? api.mensajes.first : 'Listo, guardamos tu reseña.';
  }

  Future<void> borrarResena(String resenaId) async {
    await _dio.delete('/mi/resenas/$resenaId');
  }

  Future<void> guardarFavorito(String tipo, String id) async {
    await _dio.put('/mi/favoritos', data: {'tipo': tipo, 'id': id});
  }

  Future<void> quitarFavorito(String tipo, String id) async {
    await _dio.delete('/mi/favoritos/$tipo/$id');
  }
}

final repositorioDetalleProvider = Provider<RepositorioDetalle>((ref) => RepositorioDetalle(ref.watch(dioProvider)));

final negocioProvider =
    FutureProvider.family<NegocioDetalle, String>((ref, slug) => ref.watch(repositorioDetalleProvider).negocio(slug));

final lugarProvider =
    FutureProvider.family<LugarDetalle, String>((ref, slug) => ref.watch(repositorioDetalleProvider).lugar(slug));

final eventoProvider =
    FutureProvider.family<EventoDetalle, String>((ref, slug) => ref.watch(repositorioDetalleProvider).evento(slug));

final resenasProvider =
    FutureProvider.family<ResenasPublicas, String>((ref, slug) => ref.watch(repositorioDetalleProvider).resenas(slug));

/// Los favoritos de la cuenta. Sin sesión, la lista va vacía.
class FavoritosNotifier extends AsyncNotifier<List<Favorito>> {
  @override
  Future<List<Favorito>> build() async {
    final usuario = ref.watch(sesionProvider).valueOrNull;
    if (usuario == null) return [];
    return ref.read(repositorioDetalleProvider).favoritos();
  }

  bool esFavorito(String tipo, String id) =>
      (state.valueOrNull ?? const <Favorito>[]).any((f) => f.tipo == tipo && f.id == id);

  /// Guarda o quita. Cambia al instante y, si la API falla, regresa a como estaba y lanza el error.
  Future<void> alternar(String tipo, String id, {String nombre = '', String slug = '', String? imagenUrl}) async {
    final antes = state.valueOrNull ?? const <Favorito>[];
    final existe = antes.any((f) => f.tipo == tipo && f.id == id);
    final repo = ref.read(repositorioDetalleProvider);
    state = AsyncData(existe
        ? antes.where((f) => !(f.tipo == tipo && f.id == id)).toList()
        : [Favorito(tipo: tipo, id: id, slug: slug, nombre: nombre, imagenUrl: imagenUrl), ...antes]);
    try {
      if (existe) {
        await repo.quitarFavorito(tipo, id);
      } else {
        await repo.guardarFavorito(tipo, id);
        ref.invalidateSelf();
      }
    } catch (e) {
      state = AsyncData(antes);
      throw ErrorApi.desde(e);
    }
  }
}

final favoritosProvider = AsyncNotifierProvider<FavoritosNotifier, List<Favorito>>(FavoritosNotifier.new);

final misResenasProvider = FutureProvider.autoDispose<List<MiResena>>((ref) => ref.watch(repositorioDetalleProvider).misResenas());
