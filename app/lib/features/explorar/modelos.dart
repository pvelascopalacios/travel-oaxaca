/// Modelos de lo que devuelve /publico (negocios, lugares, regiones, facetas).

double? _num(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

int? _int(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

class Pagina<T> {
  const Pagina({required this.elementos, required this.total, required this.pagina, required this.tamano});

  final List<T> elementos;
  final int total;
  final int pagina;
  final int tamano;

  bool get hayMas => (pagina + 1) * tamano < total;

  static Pagina<T> desdeJson<T>(dynamic json, T Function(Map<String, dynamic>) convertir) {
    final m = (json is Map) ? Map<String, dynamic>.from(json) : <String, dynamic>{};
    final lista = (m['elementos'] is List) ? m['elementos'] as List : const [];
    return Pagina<T>(
      elementos: lista.whereType<Map>().map((e) => convertir(Map<String, dynamic>.from(e))).toList(),
      total: _int(m['total']) ?? lista.length,
      pagina: _int(m['pagina']) ?? 0,
      tamano: _int(m['tamano']) ?? (lista.isEmpty ? 1 : lista.length),
    );
  }
}

class NegocioTarjeta {
  const NegocioTarjeta({
    required this.id,
    required this.slug,
    required this.nombre,
    this.categoriaClave,
    this.categoriaNombre,
    this.descripcionCorta,
    this.municipioNombre,
    this.regionNombre,
    this.rangoPrecio,
    this.precioDesde,
    this.unidadPrecio,
    this.distanciaM,
    this.latitud,
    this.longitud,
    this.abiertoAhora,
    this.portadaUrl,
    this.verificado = false,
    this.calificacion,
    this.totalResenas = 0,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? categoriaClave;
  final String? categoriaNombre;
  final String? descripcionCorta;
  final String? municipioNombre;
  final String? regionNombre;
  final int? rangoPrecio;
  final double? precioDesde;
  final String? unidadPrecio;
  final int? distanciaM;
  final double? latitud;
  final double? longitud;
  final bool? abiertoAhora;
  final String? portadaUrl;
  final bool verificado;
  final double? calificacion;
  final int totalResenas;

  factory NegocioTarjeta.desdeJson(Map<String, dynamic> j) => NegocioTarjeta(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        categoriaClave: j['categoriaClave']?.toString(),
        categoriaNombre: j['categoriaNombre']?.toString(),
        descripcionCorta: j['descripcionCorta']?.toString(),
        municipioNombre: j['municipioNombre']?.toString(),
        regionNombre: j['regionNombre']?.toString(),
        rangoPrecio: _int(j['rangoPrecio']),
        precioDesde: _num(j['precioDesde']),
        unidadPrecio: j['unidadPrecio']?.toString(),
        distanciaM: _int(j['distanciaM']),
        latitud: _num(j['latitud']),
        longitud: _num(j['longitud']),
        abiertoAhora: j['abiertoAhora'] is bool ? j['abiertoAhora'] as bool : null,
        portadaUrl: j['portadaUrl']?.toString(),
        verificado: j['verificado'] == true,
        calificacion: _num(j['calificacionPromedio']),
        totalResenas: _int(j['totalResenas']) ?? 0,
      );

  /// "$$" según el rango, o "Desde $850" si el negocio capturó precio.
  String? get precioTexto {
    if (precioDesde != null && precioDesde! > 0) {
      return 'Desde \$${precioDesde!.toStringAsFixed(precioDesde! % 1 == 0 ? 0 : 2)}';
    }
    if (rangoPrecio != null && rangoPrecio! > 0) return '\$' * rangoPrecio!.clamp(1, 4);
    return null;
  }

  String get ubicacion {
    final partes = <String>[
      if (categoriaNombre != null && categoriaNombre!.isNotEmpty) categoriaNombre!,
      if (municipioNombre != null && municipioNombre!.isNotEmpty) municipioNombre!,
    ];
    return partes.join(' · ');
  }

  bool get tieneCoordenadas => latitud != null && longitud != null;

  /// "a pie 4 min" si está a menos de 3 km (unos 80 m por minuto).
  String? get aPieTexto => textoAPie(distanciaM);

  String? get distanciaTexto {
    final d = distanciaM;
    if (d == null) return null;
    return d < 1000 ? '$d m' : '${(d / 1000).toStringAsFixed(1)} km';
  }
}

/// "a pie 4 min" si está a menos de 3 km (unos 80 m por minuto); si no, null.
String? textoAPie(int? metros) {
  if (metros == null || metros > 3000) return null;
  final min = (metros / 80).ceil();
  return 'a pie ${min < 1 ? 1 : min} min';
}

class LugarTarjeta {
  const LugarTarjeta({
    required this.id,
    required this.slug,
    required this.nombre,
    this.tipo,
    this.resumen,
    this.municipioNombre,
    this.regionNombre,
    this.portadaUrl,
    this.destacado = false,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? tipo;
  final String? resumen;
  final String? municipioNombre;
  final String? regionNombre;
  final String? portadaUrl;
  final bool destacado;

  factory LugarTarjeta.desdeJson(Map<String, dynamic> j) => LugarTarjeta(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        tipo: j['tipo']?.toString(),
        resumen: j['resumen']?.toString(),
        municipioNombre: j['municipioNombre']?.toString(),
        regionNombre: j['regionNombre']?.toString(),
        portadaUrl: j['portadaUrl']?.toString(),
        destacado: j['destacado'] == true,
      );
}

class EventoTarjeta {
  const EventoTarjeta({
    required this.id,
    required this.slug,
    required this.nombre,
    this.descripcion,
    this.fechaInicio,
    this.fechaFin,
    this.municipioNombre,
    this.regionNombre,
    this.temporadaNombre,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? descripcion;
  final DateTime? fechaInicio;
  final DateTime? fechaFin;
  final String? municipioNombre;
  final String? regionNombre;
  final String? temporadaNombre;

  factory EventoTarjeta.desdeJson(Map<String, dynamic> j) => EventoTarjeta(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        descripcion: j['descripcion']?.toString(),
        fechaInicio: DateTime.tryParse((j['fechaInicio'] ?? '').toString()),
        fechaFin: DateTime.tryParse((j['fechaFin'] ?? '').toString()),
        municipioNombre: j['municipioNombre']?.toString(),
        regionNombre: j['regionNombre']?.toString(),
        temporadaNombre: j['temporadaNombre']?.toString(),
      );

  static const _meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  String get diaTexto => fechaInicio == null ? '–' : '${fechaInicio!.day}';
  String get mesTexto => fechaInicio == null ? '' : _meses[fechaInicio!.month - 1].toUpperCase();

  /// "12 nov" o "12 nov – 15 nov".
  String get fechasTexto {
    final a = fechaInicio;
    if (a == null) return 'Fecha por confirmar';
    final ini = '${a.day} ${_meses[a.month - 1]}';
    final b = fechaFin;
    if (b == null || (b.year == a.year && b.month == a.month && b.day == a.day)) return ini;
    return '$ini – ${b.day} ${_meses[b.month - 1]}';
  }

  String get lugarTexto => [municipioNombre, regionNombre].whereType<String>().where((e) => e.isNotEmpty).take(1).join();
}

class RegionConteo {
  const RegionConteo({
    required this.id,
    required this.slug,
    required this.nombre,
    required this.totalNegocios,
    this.portadaUrl,
  });

  final String id;
  final String slug;
  final String nombre;
  final int totalNegocios;
  final String? portadaUrl;

  factory RegionConteo.desdeJson(Map<String, dynamic> j) => RegionConteo(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        totalNegocios: _int(j['totalNegocios']) ?? 0,
        portadaUrl: j['portadaUrl']?.toString(),
      );
}

class Faceta {
  const Faceta({required this.categoriaId, required this.clave, required this.nombre, this.padreClave, required this.total});

  final String categoriaId;
  final String clave;
  final String nombre;
  final String? padreClave;
  final int total;

  factory Faceta.desdeJson(Map<String, dynamic> j) => Faceta(
        categoriaId: (j['categoriaId'] ?? '').toString(),
        clave: (j['clave'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        padreClave: j['padreClave']?.toString(),
        total: _int(j['total']) ?? 0,
      );
}

/// Un chip de categoría principal: junta todas sus subcategorías.
class CategoriaChip {
  const CategoriaChip({required this.clave, required this.nombre, required this.ids, required this.total});

  final String clave;
  final String nombre;
  final List<String> ids;
  final int total;
}

/// Agrupa las facetas por categoría principal (padreClave, o la clave si no tiene padre).
List<CategoriaChip> agruparCategorias(List<Faceta> facetas) {
  final grupos = <String, List<Faceta>>{};
  for (final f in facetas) {
    final k = (f.padreClave != null && f.padreClave!.isNotEmpty) ? f.padreClave! : f.clave;
    grupos.putIfAbsent(k, () => []).add(f);
  }
  final chips = <CategoriaChip>[];
  grupos.forEach((clave, lista) {
    final propia = lista.where((f) => f.clave == clave);
    final nombre = propia.isNotEmpty ? propia.first.nombre : _legible(clave);
    chips.add(CategoriaChip(
      clave: clave,
      nombre: nombre,
      ids: lista.map((f) => f.categoriaId).toList(),
      total: lista.fold<int>(0, (a, f) => a + f.total),
    ));
  });
  chips.sort((a, b) => b.total.compareTo(a.total));
  return chips;
}

String _legible(String clave) {
  final t = clave.replaceAll(RegExp(r'[_\-]+'), ' ').trim();
  return t.isEmpty ? clave : t[0].toUpperCase() + t.substring(1);
}

/// Los filtros de la búsqueda de negocios.
class FiltrosNegocios {
  const FiltrosNegocios({
    this.q = '',
    this.categoriaIds = const [],
    this.regionId,
    this.precioMax,
    this.abiertoAhora = false,
    this.orden = 'relevancia',
  });

  final String q;
  final List<String> categoriaIds;
  final String? regionId;
  final int? precioMax;
  final bool abiertoAhora;
  final String orden;

  FiltrosNegocios copiar({
    String? q,
    List<String>? categoriaIds,
    Object? regionId = _sin,
    Object? precioMax = _sin,
    bool? abiertoAhora,
    String? orden,
  }) =>
      FiltrosNegocios(
        q: q ?? this.q,
        categoriaIds: categoriaIds ?? this.categoriaIds,
        regionId: identical(regionId, _sin) ? this.regionId : regionId as String?,
        precioMax: identical(precioMax, _sin) ? this.precioMax : precioMax as int?,
        abiertoAhora: abiertoAhora ?? this.abiertoAhora,
        orden: orden ?? this.orden,
      );

  Map<String, dynamic> aConsulta({int pagina = 0, int tamano = 12}) {
    final c = <String, dynamic>{'pagina': pagina, 'tamano': tamano, 'orden': orden};
    if (q.trim().isNotEmpty) c['q'] = q.trim();
    if (categoriaIds.isNotEmpty) c['categoriaIds'] = categoriaIds;
    if (regionId != null) c['regionId'] = regionId;
    if (precioMax != null) c['precioMax'] = precioMax;
    if (abiertoAhora) c['abiertoAhora'] = true;
    return c;
  }

  bool get hayFiltros => categoriaIds.isNotEmpty || regionId != null || precioMax != null || abiertoAhora;
}

const Object _sin = Object();
