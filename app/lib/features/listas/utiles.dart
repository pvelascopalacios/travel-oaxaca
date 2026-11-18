import 'package:flutter/material.dart';

import 'modelos.dart';

const _meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/// "15 – 17 dic 2026", "28 dic 2026 – 2 ene 2027" o "15 dic 2026".
String textoFechas(DateTime? i, DateTime? f) {
  if (i == null && f == null) return '';
  if (i == null || f == null || (i.year == f.year && i.month == f.month && i.day == f.day)) {
    final x = i ?? f!;
    return '${x.day} ${_meses[x.month - 1]} ${x.year}';
  }
  if (i.year == f.year && i.month == f.month) return '${i.day} – ${f.day} ${_meses[f.month - 1]} ${f.year}';
  if (i.year == f.year) return '${i.day} ${_meses[i.month - 1]} – ${f.day} ${_meses[f.month - 1]} ${f.year}';
  return '${i.day} ${_meses[i.month - 1]} ${i.year} – ${f.day} ${_meses[f.month - 1]} ${f.year}';
}

/// "12 elementos", "1 elemento".
String textoElementos(int n, {String uno = 'elemento', String varios = 'elementos'}) => '$n ${n == 1 ? uno : varios}';

String detalleLista(ListaResumen l) {
  final partes = <String>[];
  if (l.esItinerario) {
    final dias = diasDeItinerario(l.fechaInicio, l.fechaFin, const []);
    if (l.fechaInicio != null && l.fechaFin != null) partes.add(textoElementos(dias, uno: 'día', varios: 'días'));
  }
  partes.add(textoElementos(l.totalElementos, uno: 'lugar', varios: 'lugares'));
  return partes.join(' · ');
}

String tipoLista(ListaResumen l) {
  if (l.esItinerario) {
    final f = textoFechas(l.fechaInicio, l.fechaFin);
    return f.isEmpty ? 'Itinerario' : 'Itinerario · $f';
  }
  return 'Lista · ${l.publica ? 'Pública' : 'Privada'}';
}

IconData iconoItem(String tipo) => switch (tipo) {
      'negocio' => Icons.storefront_outlined,
      'lugar' => Icons.account_balance_outlined,
      'ruta' => Icons.alt_route,
      _ => Icons.place_outlined,
    };

String nombreTipoItem(String tipo) => switch (tipo) {
      'negocio' => 'Negocio',
      'lugar' => 'Lugar',
      'ruta' => 'Ruta',
      _ => tipo,
    };

/// Ruta de la app para abrir un elemento, o null si no tiene página.
String? rutaDeItem(String tipo, String? slug) {
  if (slug == null || slug.isEmpty) return null;
  return switch (tipo) {
    'negocio' => '/negocio/$slug',
    'lugar' => '/lugar/$slug',
    'ruta' => '/ruta/$slug',
    _ => null,
  };
}
