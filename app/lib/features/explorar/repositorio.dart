import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cliente.dart';
import '../../core/api/respuesta.dart';
import 'modelos.dart';

/// Lecturas públicas de la API (no piden sesión).
class RepositorioExplorar {
  RepositorioExplorar(this._dio);

  final Dio _dio;

  Future<dynamic> _leer(String ruta, [Map<String, dynamic>? consulta]) async {
    final r = await _dio.get(
      ruta,
      queryParameters: consulta,
      options: Options(listFormat: ListFormat.multi),
    );
    final api = ApiRespuesta.desdeJson(r.data);
    if (!api.ok) {
      throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : 'Algo salió mal. Inténtalo de nuevo.', campos: api.errores);
    }
    return api.datos;
  }

  Future<Pagina<NegocioTarjeta>> negocios(FiltrosNegocios f, {int pagina = 0, int tamano = 12}) async {
    final d = await _leer('/publico/negocios', f.aConsulta(pagina: pagina, tamano: tamano));
    return Pagina.desdeJson(d, NegocioTarjeta.desdeJson);
  }

  /// Negocios alrededor de un punto, del más cercano al más lejano (hasta 50).
  Future<List<NegocioTarjeta>> negociosCerca(FiltrosNegocios f, double lat, double lng, double radioKm) async {
    final consulta = f.aConsulta(tamano: 50)
      ..['lat'] = lat
      ..['lng'] = lng
      ..['radioKm'] = radioKm.clamp(1, 100)
      ..['orden'] = 'distancia';
    final d = await _leer('/publico/negocios', consulta);
    return Pagina.desdeJson(d, NegocioTarjeta.desdeJson).elementos;
  }

  Future<Pagina<LugarTarjeta>> lugares(String q, {int pagina = 0, int tamano = 12}) async {
    final d = await _leer('/publico/lugares', {
      if (q.trim().isNotEmpty) 'q': q.trim(),
      'pagina': pagina,
      'tamano': tamano,
    });
    return Pagina.desdeJson(d, LugarTarjeta.desdeJson);
  }

  Future<Pagina<EventoTarjeta>> eventos(String q, {int pagina = 0, int tamano = 12}) async {
    final d = await _leer('/publico/eventos', {
      if (q.trim().isNotEmpty) 'q': q.trim(),
      'pagina': pagina,
      'tamano': tamano,
    });
    return Pagina.desdeJson(d, EventoTarjeta.desdeJson);
  }

  Future<List<RegionConteo>> regiones() async {
    final d = await _leer('/publico/regiones/conteos');
    final lista = d is List ? d : const [];
    return lista.whereType<Map>().map((e) => RegionConteo.desdeJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<List<CategoriaChip>> categorias() async {
    final d = await _leer('/publico/negocios/facetas');
    final m = d is Map ? d : const {};
    final lista = m['negocios'] is List ? m['negocios'] as List : const [];
    final facetas = lista.whereType<Map>().map((e) => Faceta.desdeJson(Map<String, dynamic>.from(e))).toList();
    return agruparCategorias(facetas);
  }
}

final repositorioExplorarProvider = Provider<RepositorioExplorar>((ref) => RepositorioExplorar(ref.watch(dioProvider)));

final regionesProvider = FutureProvider<List<RegionConteo>>((ref) => ref.watch(repositorioExplorarProvider).regiones());

final categoriasProvider = FutureProvider<List<CategoriaChip>>((ref) => ref.watch(repositorioExplorarProvider).categorias());

/// Los mejor calificados (portada de Explorar).
final destacadosProvider = FutureProvider<List<NegocioTarjeta>>((ref) async {
  final p = await ref
      .watch(repositorioExplorarProvider)
      .negocios(const FiltrosNegocios(orden: 'calificacion'), tamano: 8);
  return p.elementos;
});

/// Los próximos eventos (portada de Explorar).
final eventosProximosProvider = FutureProvider<List<EventoTarjeta>>((ref) async {
  final p = await ref.watch(repositorioExplorarProvider).eventos('', tamano: 8);
  return p.elementos;
});
