double? _num(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
int? _int(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse(v.toString()));

class RutaTarjeta {
  const RutaTarjeta({
    required this.id,
    required this.slug,
    required this.nombre,
    this.descripcion,
    this.duracionHoras,
    this.distanciaKm,
    this.dificultad,
    this.transporte,
    this.esPremium = false,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? descripcion;
  final double? duracionHoras;
  final double? distanciaKm;
  final String? dificultad;
  final String? transporte;
  final bool esPremium;

  factory RutaTarjeta.desdeJson(Map<String, dynamic> j) => RutaTarjeta(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        descripcion: j['descripcion']?.toString(),
        duracionHoras: _num(j['duracionHoras']),
        distanciaKm: _num(j['distanciaKm']),
        dificultad: j['dificultad']?.toString(),
        transporte: j['transporte']?.toString(),
        esPremium: j['esPremium'] == true,
      );
}

/// Una parada: un lugar, un negocio o un punto suelto en el mapa.
class Parada {
  const Parada({required this.orden, required this.tipo, this.nombre, this.slug, this.latitud, this.longitud, this.minutosEstimados});

  final int orden;
  final String tipo;
  final String? nombre;
  final String? slug;
  final double? latitud;
  final double? longitud;
  final int? minutosEstimados;

  bool get tieneCoordenadas => latitud != null && longitud != null;

  factory Parada.desdeJson(Map<String, dynamic> j) => Parada(
        orden: _int(j['orden']) ?? 0,
        tipo: (j['tipo'] ?? 'punto').toString(),
        nombre: j['nombre']?.toString(),
        slug: j['slug']?.toString(),
        latitud: _num(j['latitud']),
        longitud: _num(j['longitud']),
        minutosEstimados: _int(j['minutosEstimados']),
      );
}

class RutaDetalle {
  const RutaDetalle({required this.tarjeta, required this.paradas});

  final RutaTarjeta tarjeta;
  final List<Parada> paradas;

  factory RutaDetalle.desdeJson(Map<String, dynamic> j) {
    final lista = j['paradas'] is List ? j['paradas'] as List : const [];
    final paradas = lista.whereType<Map>().map((e) => Parada.desdeJson(Map<String, dynamic>.from(e))).toList()
      ..sort((a, b) => a.orden.compareTo(b.orden));
    return RutaDetalle(tarjeta: RutaTarjeta.desdeJson(j), paradas: paradas);
  }
}
