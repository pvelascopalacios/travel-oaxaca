import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../explorar/modelos.dart';
import '../explorar/repositorio.dart';

/// Lo que se le pide a la API: un punto, un radio y los filtros del mapa.
class ConsultaCerca {
  const ConsultaCerca({
    required this.lat,
    required this.lng,
    required this.radioKm,
    this.categoriaIds = const [],
    this.abiertoAhora = false,
  });

  final double lat;
  final double lng;
  final double radioKm;
  final List<String> categoriaIds;
  final bool abiertoAhora;

  @override
  bool operator ==(Object o) =>
      o is ConsultaCerca &&
      o.lat == lat &&
      o.lng == lng &&
      o.radioKm == radioKm &&
      o.abiertoAhora == abiertoAhora &&
      o.categoriaIds.length == categoriaIds.length &&
      o.categoriaIds.every(categoriaIds.contains);

  @override
  int get hashCode => Object.hash(lat, lng, radioKm, abiertoAhora, Object.hashAllUnordered(categoriaIds));
}

final negociosCercaProvider = FutureProvider.autoDispose.family<List<NegocioTarjeta>, ConsultaCerca>((ref, c) {
  final filtros = FiltrosNegocios(categoriaIds: c.categoriaIds, abiertoAhora: c.abiertoAhora);
  return ref.watch(repositorioExplorarProvider).negociosCerca(filtros, c.lat, c.lng, c.radioKm);
});
