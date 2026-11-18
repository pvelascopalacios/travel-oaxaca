import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/cliente.dart';
import '../../core/api/respuesta.dart';
import 'modelos.dart';

/// Mis listas e itinerarios.
class RepositorioListas {
  RepositorioListas(this._dio);
  final Dio _dio;

  Future<dynamic> _datos(Future<Response<dynamic>> Function() llamada, String falla) async {
    try {
      final api = ApiRespuesta.desdeJson((await llamada()).data);
      if (!api.ok) throw ErrorApi(api.mensajes.isNotEmpty ? api.mensajes.first : falla, campos: api.errores);
      return api.datos;
    } on DioException catch (e) {
      throw ErrorApi.desde(e);
    }
  }

  Future<List<ListaResumen>> mias() async {
    final d = await _datos(() => _dio.get('/mi/listas'), 'No pudimos cargar tus listas.');
    final l = d is List ? d : const [];
    return l.whereType<Map>().map((e) => ListaResumen.desdeJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<ListaDetalle> detalle(String id) async {
    final d = await _datos(() => _dio.get('/mi/listas/$id'), 'No pudimos cargar la lista.');
    return ListaDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Map<String, dynamic> _cuerpo({required String nombre, required bool esItinerario, DateTime? inicio, DateTime? fin, required bool publica}) => {
        'nombre': nombre.trim(),
        'esItinerario': esItinerario,
        'fechaInicio': esItinerario && inicio != null ? fechaIso(inicio) : null,
        'fechaFin': esItinerario && fin != null ? fechaIso(fin) : null,
        'publica': publica,
      };

  Future<ListaResumen> crear({required String nombre, required bool esItinerario, DateTime? inicio, DateTime? fin, required bool publica}) async {
    final d = await _datos(
      () => _dio.post('/mi/listas', data: _cuerpo(nombre: nombre, esItinerario: esItinerario, inicio: inicio, fin: fin, publica: publica)),
      'No pudimos crear la lista.',
    );
    return ListaResumen.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Future<ListaResumen> actualizar(String id, {required String nombre, required bool esItinerario, DateTime? inicio, DateTime? fin, required bool publica}) async {
    final d = await _datos(
      () => _dio.put('/mi/listas/$id', data: _cuerpo(nombre: nombre, esItinerario: esItinerario, inicio: inicio, fin: fin, publica: publica)),
      'No pudimos guardar los cambios.',
    );
    return ListaResumen.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  Future<void> borrar(String id) async {
    await _datos(() => _dio.delete('/mi/listas/$id'), 'No pudimos borrar la lista.');
  }

  Future<ListaDetalle> agregar(String listaId, {required String tipo, required String id, int? dia}) async {
    final d = await _datos(
      () => _dio.post('/mi/listas/$listaId/elementos', data: {'tipo': tipo, 'id': id, 'dia': dia}),
      'No pudimos agregarlo.',
    );
    return ListaDetalle.desdeJson(Map<String, dynamic>.from(d as Map));
  }

  /// Ojo: la API reemplaza día y nota con lo que mandemos (null los borra): hay que reenviar los actuales.
  Future<void> editarItem(String listaId, String itemId, {int? dia, int? orden, String? nota}) async {
    await _datos(
      () => _dio.put('/mi/listas/$listaId/elementos/$itemId', data: {'dia': dia, 'orden': orden, 'nota': nota}),
      'No pudimos guardar el cambio.',
    );
  }

  Future<void> quitarItem(String listaId, String itemId) async {
    await _datos(() => _dio.delete('/mi/listas/$listaId/elementos/$itemId'), 'No pudimos quitarlo.');
  }
}

final repositorioListasProvider = Provider<RepositorioListas>((ref) => RepositorioListas(ref.watch(dioProvider)));

final misListasProvider = FutureProvider.autoDispose<List<ListaResumen>>((ref) => ref.watch(repositorioListasProvider).mias());
final listaDetalleProvider =
    FutureProvider.autoDispose.family<ListaDetalle, String>((ref, id) => ref.watch(repositorioListasProvider).detalle(id));
