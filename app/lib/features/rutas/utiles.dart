import 'package:flutter/material.dart';

import 'modelos.dart';

const dificultades = [('facil', 'Fácil'), ('moderada', 'Moderada'), ('dificil', 'Difícil')];
const transportes = [
  ('a_pie', 'A pie'),
  ('auto', 'Auto'),
  ('bicicleta', 'Bicicleta'),
  ('transporte_publico', 'Transporte público'),
  ('mixto', 'Mixto'),
];

String nombreDificultad(String? d) => switch (d) {
      'facil' => 'Fácil',
      'moderada' => 'Moderada',
      'dificil' => 'Difícil',
      _ => '',
    };

String nombreTransporte(String? t) {
  for (final x in transportes) {
    if (x.$1 == t) return x.$2;
  }
  return '';
}

IconData iconoTransporte(String? t) => switch (t) {
      'a_pie' => Icons.directions_walk,
      'auto' => Icons.directions_car_outlined,
      'bicicleta' => Icons.directions_bike,
      'transporte_publico' => Icons.directions_bus_outlined,
      _ => Icons.alt_route,
    };

/// 0.5 -> "30 min", 3 -> "3 h", 1.5 -> "1 h 30 min".
String textoDuracion(double? horas) {
  if (horas == null || horas <= 0) return '';
  final min = (horas * 60).round();
  if (min < 60) return '$min min';
  final h = min ~/ 60;
  final m = min % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

/// 62 -> "62 km", 4.5 -> "4.5 km".
String textoKm(double? km) {
  if (km == null || km <= 0) return '';
  return km == km.roundToDouble() ? '${km.toInt()} km' : '${km.toStringAsFixed(1)} km';
}

String textoMinutos(int? m) {
  if (m == null || m <= 0) return '';
  if (m < 60) return '$m min';
  final h = m ~/ 60;
  final r = m % 60;
  return r == 0 ? '$h h' : '$h h $r min';
}

String subtituloParada(Parada p) {
  final tipo = switch (p.tipo) {
    'lugar' => 'Lugar',
    'negocio' => 'Negocio',
    _ => 'Punto en el mapa',
  };
  final t = textoMinutos(p.minutosEstimados);
  return t.isEmpty ? tipo : '$tipo · $t';
}
