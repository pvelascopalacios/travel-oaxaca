import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cliente.dart';
import '../../core/api/respuesta.dart';
import '../explorar/modelos.dart' show Pagina;
import 'modelos.dart';

class RepositorioRutas {
  RepositorioRutas(this._dio);
  final Dio _dio;

  Future<dynamic> _leer(String ruta, [Map<String, dynamic>? consulta]) async {
    try {
      final r = await _dio.get(ruta, queryParameters: consulta);
      final api = ApiRespuesta.desdeJson(r.data);
      if (!api.ok) throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : 'Algo salió mal. Inténtalo de nuevo.');
      return api.datos;
    } on DioException catch (e) {
      throw ErrorApi.desde(e);
    }
  }

  Future<Pagina<RutaTarjeta>> rutas({String? dificultad, String? transporte, int pagina = 0, int tamano = 12}) async {
    final d = await _leer('/publico/rutas', {
      if (dificultad != null) 'dificultad': dificultad,
      if (transporte != null) 'transporte': transporte,
      'pagina': pagina,
      'tamano': tamano,
    });
    return Pagina.desdeJson(d, RutaTarjeta.desdeJson);
  }

  Future<RutaDetalle> ruta(String slug) async {
    final d = await _leer('/publico/rutas/$slug');
    return RutaDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }
}

final repositorioRutasProvider = Provider<RepositorioRutas>((ref) => RepositorioRutas(ref.watch(dioProvider)));

final rutaProvider = FutureProvider.autoDispose.family<RutaDetalle, String>((ref, slug) => ref.watch(repositorioRutasProvider).ruta(slug));

/// Las primeras rutas, para la portada de Explorar.
final rutasDestacadasProvider = FutureProvider<List<RutaTarjeta>>((ref) async {
  final p = await ref.watch(repositorioRutasProvider).rutas(tamano: 8);
  return p.elementos;
});
