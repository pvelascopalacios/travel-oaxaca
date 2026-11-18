int? _int(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse(v.toString()));
DateTime? _fecha(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());

String fechaIso(DateTime f) => '${f.year.toString().padLeft(4, '0')}-${f.month.toString().padLeft(2, '0')}-${f.day.toString().padLeft(2, '0')}';

class ListaResumen {
  const ListaResumen({
    required this.id,
    required this.nombre,
    this.esItinerario = false,
    this.fechaInicio,
    this.fechaFin,
    this.publica = false,
    this.totalElementos = 0,
  });

  final String id;
  final String nombre;
  final bool esItinerario;
  final DateTime? fechaInicio;
  final DateTime? fechaFin;
  final bool publica;
  final int totalElementos;

  factory ListaResumen.desdeJson(Map<String, dynamic> j) => ListaResumen(
        id: (j['id'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        esItinerario: j['esItinerario'] == true,
        fechaInicio: _fecha(j['fechaInicio']),
        fechaFin: _fecha(j['fechaFin']),
        publica: j['publica'] == true,
        totalElementos: _int(j['totalElementos']) ?? 0,
      );
}

class ListaItem {
  const ListaItem({required this.itemId, required this.tipo, required this.id, this.slug, required this.nombre, this.dia, this.orden = 0, this.nota, this.imagenUrl});

  final String itemId;
  final String tipo;
  final String id;
  final String? slug;
  final String nombre;
  final int? dia;
  final int orden;
  final String? nota;
  final String? imagenUrl;

  factory ListaItem.desdeJson(Map<String, dynamic> j) => ListaItem(
        itemId: (j['itemId'] ?? '').toString(),
        tipo: (j['tipo'] ?? '').toString(),
        id: (j['id'] ?? '').toString(),
        slug: j['slug']?.toString(),
        nombre: (j['nombre'] ?? '').toString(),
        dia: _int(j['dia']),
        orden: _int(j['orden']) ?? 0,
        nota: (j['nota'] ?? '').toString().isEmpty ? null : j['nota'].toString(),
        imagenUrl: j['imagenUrl']?.toString(),
      );
}

class ListaDetalle {
  const ListaDetalle({
    required this.id,
    required this.nombre,
    this.esItinerario = false,
    this.fechaInicio,
    this.fechaFin,
    this.publica = false,
    this.elementos = const [],
  });

  final String id;
  final String nombre;
  final bool esItinerario;
  final DateTime? fechaInicio;
  final DateTime? fechaFin;
  final bool publica;
  final List<ListaItem> elementos;

  factory ListaDetalle.desdeJson(Map<String, dynamic> j) {
    final lista = j['elementos'] is List ? j['elementos'] as List : const [];
    return ListaDetalle(
      id: (j['id'] ?? '').toString(),
      nombre: (j['nombre'] ?? '').toString(),
      esItinerario: j['esItinerario'] == true,
      fechaInicio: _fecha(j['fechaInicio']),
      fechaFin: _fecha(j['fechaFin']),
      publica: j['publica'] == true,
      elementos: lista.whereType<Map>().map((e) => ListaItem.desdeJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  ListaResumen aResumen() =>
      ListaResumen(id: id, nombre: nombre, esItinerario: esItinerario, fechaInicio: fechaInicio, fechaFin: fechaFin, publica: publica, totalElementos: elementos.length);

  /// Cuántos días mostrar: los de las fechas, o el último día con elementos, y al menos 1.
  int get totalDias => diasDeItinerario(fechaInicio, fechaFin, elementos.map((e) => e.dia ?? 1));

  List<ListaItem> delDia(int dia) =>
      (elementos.where((e) => (e.dia ?? 1) == dia).toList()..sort((a, b) => a.orden.compareTo(b.orden)));
}

int diasDeItinerario(DateTime? inicio, DateTime? fin, Iterable<int> diasConElementos) {
  var n = 1;
  if (inicio != null && fin != null && !fin.isBefore(inicio)) {
    n = DateTime(fin.year, fin.month, fin.day).difference(DateTime(inicio.year, inicio.month, inicio.day)).inDays + 1;
  }
  for (final d in diasConElementos) {
    if (d > n) n = d;
  }
  return n.clamp(1, 60);
}
