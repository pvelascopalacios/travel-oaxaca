import '../explorar/modelos.dart';

double? _d(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

int? _i(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

List<Map<String, dynamic>> _lista(dynamic v) =>
    v is List ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];

class Foto {
  const Foto({required this.url, this.pie, this.esPortada = false});
  final String url;
  final String? pie;
  final bool esPortada;

  factory Foto.desdeJson(Map<String, dynamic> j) =>
      Foto(url: (j['url'] ?? '').toString(), pie: j['pieTexto']?.toString(), esPortada: j['esPortada'] == true);
}

class Contacto {
  const Contacto({required this.tipo, required this.valor, this.esPrincipal = false});
  final String tipo;
  final String valor;
  final bool esPrincipal;

  factory Contacto.desdeJson(Map<String, dynamic> j) =>
      Contacto(tipo: (j['tipo'] ?? '').toString(), valor: (j['valor'] ?? '').toString(), esPrincipal: j['esPrincipal'] == true);
}

class ServicioPublico {
  const ServicioPublico({required this.clave, required this.nombre});
  final String clave;
  final String nombre;

  factory ServicioPublico.desdeJson(Map<String, dynamic> j) =>
      ServicioPublico(clave: (j['clave'] ?? '').toString(), nombre: (j['nombre'] ?? '').toString());
}

class Horario {
  const Horario({required this.dia, this.abre, this.cierra, this.cerrado = false});
  final int dia; // 0 domingo … 6 sábado
  final String? abre;
  final String? cierra;
  final bool cerrado;

  factory Horario.desdeJson(Map<String, dynamic> j) => Horario(
        dia: _i(j['diaSemana']) ?? 0,
        abre: j['abre']?.toString(),
        cierra: j['cierra']?.toString(),
        cerrado: j['cerrado'] == true,
      );
}

class Sucursal {
  const Sucursal({
    required this.nombre,
    this.esPrincipal = false,
    this.municipioNombre,
    this.regionNombre,
    this.direccion,
    this.referencia,
    this.latitud,
    this.longitud,
    this.abiertoAhora,
    this.horarios = const [],
  });

  final String nombre;
  final bool esPrincipal;
  final String? municipioNombre;
  final String? regionNombre;
  final String? direccion;
  final String? referencia;
  final double? latitud;
  final double? longitud;
  final bool? abiertoAhora;
  final List<Horario> horarios;

  factory Sucursal.desdeJson(Map<String, dynamic> j) => Sucursal(
        nombre: (j['nombre'] ?? '').toString(),
        esPrincipal: j['esPrincipal'] == true,
        municipioNombre: j['municipioNombre']?.toString(),
        regionNombre: j['regionNombre']?.toString(),
        direccion: j['direccion']?.toString(),
        referencia: j['referencia']?.toString(),
        latitud: _d(j['latitud']),
        longitud: _d(j['longitud']),
        abiertoAhora: j['abiertoAhora'] is bool ? j['abiertoAhora'] as bool : null,
        horarios: _lista(j['horarios']).map(Horario.desdeJson).toList(),
      );

  bool get tieneCoordenadas => latitud != null && longitud != null;
}

class Oferta {
  const Oferta({
    required this.id,
    required this.tipo,
    required this.nombre,
    this.descripcion,
    this.precioDesde,
    this.unidadPrecio,
    this.duracionMin,
    this.capacidad,
    this.seccion,
  });

  final String id;
  final String tipo;
  final String nombre;
  final String? descripcion;
  final double? precioDesde;
  final String? unidadPrecio;
  final int? duracionMin;
  final int? capacidad;
  final String? seccion;

  factory Oferta.desdeJson(Map<String, dynamic> j) => Oferta(
        id: (j['id'] ?? '').toString(),
        tipo: (j['tipo'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        descripcion: j['descripcion']?.toString(),
        precioDesde: _d(j['precioDesde']),
        unidadPrecio: j['unidadPrecio']?.toString(),
        duracionMin: _i(j['duracionMin']),
        capacidad: _i(j['capacidad']),
        seccion: j['seccion']?.toString(),
      );

  String? get precioTexto => (precioDesde == null || precioDesde! <= 0)
      ? null
      : '\$${precioDesde!.toStringAsFixed(precioDesde! % 1 == 0 ? 0 : 2)}';

  String get detalle {
    final partes = <String>[
      if (capacidad != null) '$capacidad ${capacidad == 1 ? 'persona' : 'personas'}',
      if (duracionMin != null) _duracion(duracionMin!),
    ];
    return partes.join(' · ');
  }

  static String _duracion(int min) {
    if (min < 60) return '$min min';
    final h = min ~/ 60;
    final m = min % 60;
    return m == 0 ? '$h h' : '$h h $m min';
  }
}

class Promocion {
  const Promocion({required this.id, required this.titulo, this.descripcion, this.codigo, this.fin});
  final String id;
  final String titulo;
  final String? descripcion;
  final String? codigo;
  final DateTime? fin;

  factory Promocion.desdeJson(Map<String, dynamic> j) => Promocion(
        id: (j['id'] ?? '').toString(),
        titulo: (j['titulo'] ?? '').toString(),
        descripcion: j['descripcion']?.toString(),
        codigo: j['codigo']?.toString(),
        fin: DateTime.tryParse((j['fin'] ?? '').toString()),
      );
}

class NegocioDetalle {
  const NegocioDetalle({
    required this.id,
    required this.slug,
    required this.nombre,
    this.categoriaNombre,
    this.descripcionCorta,
    this.descripcion,
    this.politicas,
    this.rangoPrecio,
    this.precioDesde,
    this.unidadPrecio,
    this.verificado = false,
    this.sucursales = const [],
    this.contactos = const [],
    this.servicios = const [],
    this.idiomas = const [],
    this.fotos = const [],
    this.calificacion,
    this.totalResenas = 0,
    this.promociones = const [],
    this.ofertas = const [],
    this.posicion,
    this.posicionTotal,
    this.posicionMunicipio,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? categoriaNombre;
  final String? descripcionCorta;
  final String? descripcion;
  final String? politicas;
  final int? rangoPrecio;
  final double? precioDesde;
  final String? unidadPrecio;
  final bool verificado;
  final List<Sucursal> sucursales;
  final List<Contacto> contactos;
  final List<ServicioPublico> servicios;
  final List<String> idiomas;
  final List<Foto> fotos;
  final double? calificacion;
  final int totalResenas;
  final List<Promocion> promociones;
  final List<Oferta> ofertas;
  final int? posicion;
  final int? posicionTotal;
  final String? posicionMunicipio;

  factory NegocioDetalle.desdeJson(Map<String, dynamic> j) {
    final pos = j['posicion'] is Map ? Map<String, dynamic>.from(j['posicion'] as Map) : null;
    return NegocioDetalle(
      id: (j['id'] ?? '').toString(),
      slug: (j['slug'] ?? '').toString(),
      nombre: (j['nombre'] ?? '').toString(),
      categoriaNombre: j['categoriaNombre']?.toString(),
      descripcionCorta: j['descripcionCorta']?.toString(),
      descripcion: j['descripcion']?.toString(),
      politicas: j['politicas']?.toString(),
      rangoPrecio: _i(j['rangoPrecio']),
      precioDesde: _d(j['precioDesde']),
      unidadPrecio: j['unidadPrecio']?.toString(),
      verificado: j['verificado'] == true,
      sucursales: _lista(j['sucursales']).map(Sucursal.desdeJson).toList(),
      contactos: _lista(j['contactos']).map(Contacto.desdeJson).toList(),
      servicios: _lista(j['servicios']).map(ServicioPublico.desdeJson).toList(),
      idiomas: _lista(j['idiomas']).map((e) => (e['nombre'] ?? e['codigo'] ?? '').toString()).where((e) => e.isNotEmpty).toList(),
      fotos: _lista(j['fotos']).map(Foto.desdeJson).where((f) => f.url.isNotEmpty).toList(),
      calificacion: _d(j['calificacionPromedio']),
      totalResenas: _i(j['totalResenas']) ?? 0,
      promociones: _lista(j['promociones']).map(Promocion.desdeJson).toList(),
      ofertas: _lista(j['ofertas']).map(Oferta.desdeJson).toList(),
      posicion: pos == null ? null : _i(pos['posicion']),
      posicionTotal: pos == null ? null : _i(pos['total']),
      posicionMunicipio: pos?['municipioNombre']?.toString(),
    );
  }

  Sucursal? get principal {
    if (sucursales.isEmpty) return null;
    for (final s in sucursales) {
      if (s.esPrincipal) return s;
    }
    return sucursales.first;
  }

  String? contacto(String tipo) {
    String? primero;
    for (final c in contactos) {
      if (c.tipo == tipo && c.valor.trim().isNotEmpty) {
        if (c.esPrincipal) return c.valor;
        primero ??= c.valor;
      }
    }
    return primero;
  }

  String? get precioTexto {
    if (precioDesde != null && precioDesde! > 0) {
      return '\$${precioDesde!.toStringAsFixed(precioDesde! % 1 == 0 ? 0 : 2)}';
    }
    if (rangoPrecio != null && rangoPrecio! > 0) return '\$' * rangoPrecio!.clamp(1, 4);
    return null;
  }

  String get subtitulo {
    final s = principal;
    return [categoriaNombre, s?.municipioNombre, s?.regionNombre]
        .whereType<String>()
        .where((e) => e.isNotEmpty)
        .join(' · ');
  }

  /// "Hasta las 22:00" según el horario de hoy, si lo hay. [hoy] va de 0 (domingo) a 6.
  String? cierraHoy(int hoy) {
    final s = principal;
    if (s == null) return null;
    final de = s.horarios.where((h) => h.dia == hoy && !h.cerrado && h.cierra != null).toList();
    if (de.isEmpty) return null;
    return de.last.cierra;
  }
}

class LugarDetalle {
  const LugarDetalle({
    required this.id,
    required this.slug,
    required this.nombre,
    this.tipo,
    this.resumen,
    this.historia,
    this.recomendaciones,
    this.municipioNombre,
    this.regionNombre,
    this.latitud,
    this.longitud,
    this.fotos = const [],
    this.atractivos = const [],
    this.negociosCercanos = const [],
    this.mejorEpoca,
    this.comoLlegar,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? tipo;
  final String? resumen;
  final String? historia;
  final String? recomendaciones;
  final String? municipioNombre;
  final String? regionNombre;
  final double? latitud;
  final double? longitud;
  final List<Foto> fotos;
  final List<LugarTarjeta> atractivos;
  final List<NegocioTarjeta> negociosCercanos;
  final String? mejorEpoca;
  final String? comoLlegar;

  factory LugarDetalle.desdeJson(Map<String, dynamic> j) => LugarDetalle(
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        tipo: j['tipo']?.toString(),
        resumen: j['resumen']?.toString(),
        historia: j['historia']?.toString(),
        recomendaciones: j['recomendaciones']?.toString(),
        municipioNombre: j['municipioNombre']?.toString(),
        regionNombre: j['regionNombre']?.toString(),
        latitud: _d(j['latitud']),
        longitud: _d(j['longitud']),
        fotos: _lista(j['fotos']).map(Foto.desdeJson).where((f) => f.url.isNotEmpty).toList(),
        atractivos: _lista(j['atractivos']).map(LugarTarjeta.desdeJson).toList(),
        negociosCercanos: _lista(j['negociosCercanos']).map(NegocioTarjeta.desdeJson).toList(),
        mejorEpoca: j['mejorEpoca']?.toString(),
        comoLlegar: j['comoLlegar']?.toString(),
      );

  String get subtitulo =>
      [municipioNombre, regionNombre].whereType<String>().where((e) => e.isNotEmpty).join(' · ');
}

class EventoDetalle {
  const EventoDetalle({
    required this.tarjeta,
    this.latitud,
    this.longitud,
    this.negocios = const [],
  });

  final EventoTarjeta tarjeta;
  final double? latitud;
  final double? longitud;
  final List<NegocioTarjeta> negocios;

  factory EventoDetalle.desdeJson(Map<String, dynamic> j) => EventoDetalle(
        tarjeta: EventoTarjeta.desdeJson(j),
        latitud: _d(j['latitud']),
        longitud: _d(j['longitud']),
        negocios: _lista(j['negocios']).map(NegocioTarjeta.desdeJson).toList(),
      );
}

class Resena {
  const Resena({
    required this.id,
    required this.calificacion,
    this.titulo,
    this.texto,
    required this.autorNombre,
    this.creadoEn,
    this.utiles = 0,
    this.respuesta,
  });

  final String id;
  final int calificacion;
  final String? titulo;
  final String? texto;
  final String autorNombre;
  final DateTime? creadoEn;
  final int utiles;
  final String? respuesta;

  factory Resena.desdeJson(Map<String, dynamic> j) => Resena(
        id: (j['id'] ?? '').toString(),
        calificacion: _i(j['calificacion']) ?? 0,
        titulo: j['titulo']?.toString(),
        texto: j['texto']?.toString(),
        autorNombre: (j['autorNombre'] ?? 'Visitante').toString(),
        creadoEn: DateTime.tryParse((j['creadoEn'] ?? '').toString()),
        utiles: _i(j['utiles']) ?? 0,
        respuesta: j['respuesta'] is Map ? (j['respuesta'] as Map)['texto']?.toString() : null,
      );
}

class ResenasPublicas {
  const ResenasPublicas({required this.resenas, required this.promedio, required this.total, required this.distribucion});
  final List<Resena> resenas;
  final double promedio;
  final int total;
  final Map<int, int> distribucion;

  factory ResenasPublicas.desdeJson(dynamic json) {
    final m = json is Map ? Map<String, dynamic>.from(json) : <String, dynamic>{};
    final pag = m['resenas'] is Map ? Map<String, dynamic>.from(m['resenas'] as Map) : <String, dynamic>{};
    final cal = m['calificacion'] is Map ? Map<String, dynamic>.from(m['calificacion'] as Map) : <String, dynamic>{};
    final dist = <int, int>{};
    if (cal['distribucion'] is Map) {
      (cal['distribucion'] as Map).forEach((k, v) {
        final kk = int.tryParse(k.toString());
        final vv = _i(v);
        if (kk != null && vv != null) dist[kk] = vv;
      });
    }
    return ResenasPublicas(
      resenas: _lista(pag['elementos']).map(Resena.desdeJson).toList(),
      promedio: _d(cal['promedio']) ?? 0,
      total: _i(cal['total']) ?? 0,
      distribucion: dist,
    );
  }
}

class Favorito {
  const Favorito({required this.tipo, required this.id, required this.slug, required this.nombre, this.imagenUrl});
  final String tipo;
  final String id;
  final String slug;
  final String nombre;
  final String? imagenUrl;

  factory Favorito.desdeJson(Map<String, dynamic> j) => Favorito(
        tipo: (j['tipo'] ?? '').toString(),
        id: (j['id'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        imagenUrl: j['imagenUrl']?.toString(),
      );
}

/// Mi reseña de un negocio, con el estado que le dio la revisión.
class ResenaPropia {
  const ResenaPropia({
    required this.id,
    required this.calificacion,
    this.titulo,
    this.texto,
    this.fechaVisita,
    this.estado = 'publicada',
    this.creadoEn,
  });

  final String id;
  final int calificacion;
  final String? titulo;
  final String? texto;
  final DateTime? fechaVisita;
  final String estado;
  final DateTime? creadoEn;

  bool get pendiente => estado == 'pendiente';
  bool get noPublicada => estado == 'rechazada' || estado == 'oculta';

  factory ResenaPropia.desdeJson(Map<String, dynamic> j) => ResenaPropia(
        id: (j['id'] ?? '').toString(),
        calificacion: _i(j['calificacion']) ?? 0,
        titulo: j['titulo']?.toString(),
        texto: j['texto']?.toString(),
        fechaVisita: DateTime.tryParse((j['fechaVisita'] ?? '').toString()),
        estado: (j['estado'] ?? 'publicada').toString(),
        creadoEn: DateTime.tryParse((j['creadoEn'] ?? '').toString()),
      );
}

/// Una fila de "Mis reseñas": la reseña y el negocio al que pertenece.
class MiResena {
  const MiResena({
    required this.resena,
    required this.negocioId,
    required this.negocioSlug,
    required this.negocioNombre,
    this.categoriaClave,
    this.municipioNombre,
  });

  final ResenaPropia resena;
  final String negocioId;
  final String negocioSlug;
  final String negocioNombre;
  final String? categoriaClave;
  final String? municipioNombre;

  factory MiResena.desdeJson(Map<String, dynamic> j) => MiResena(
        resena: ResenaPropia.desdeJson(j['resena'] is Map ? Map<String, dynamic>.from(j['resena'] as Map) : <String, dynamic>{}),
        negocioId: (j['negocioId'] ?? '').toString(),
        negocioSlug: (j['negocioSlug'] ?? '').toString(),
        negocioNombre: (j['negocioNombre'] ?? '').toString(),
        categoriaClave: j['categoriaClave']?.toString(),
        municipioNombre: j['municipioNombre']?.toString(),
      );
}
