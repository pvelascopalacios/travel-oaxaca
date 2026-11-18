/// Reglas de la reseña que repiten las de la API (para avisar antes de enviar).
const resenaTextoMinimo = 20;
const resenaTextoMaximo = 2000;
const resenaTituloMaximo = 80;

const _meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/// "nov 2026".
String mesAnio(DateTime f) => '${_meses[f.month - 1]} ${f.year}';

/// "15 oct 2026".
String fechaCorta(DateTime f) => '${f.day} ${_meses[f.month - 1]} ${f.year}';

/// Igual que la API: "Prudens Velasco Palacios" -> "Prudens V.".
String nombreCorto(String nombre) {
  final partes = nombre.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (partes.isEmpty) return 'Viajero';
  if (partes.length == 1) return partes[0];
  return '${partes[0]} ${partes[1][0].toUpperCase()}.';
}

String etiquetaCalificacion(int c) => switch (c) {
      1 => 'Malo',
      2 => 'Regular',
      3 => 'Bien',
      4 => 'Muy bueno',
      5 => 'Excelente',
      _ => 'Toca una estrella',
    };

bool textoValido(String t) => t.trim().length >= resenaTextoMinimo && t.trim().length <= resenaTextoMaximo;

/// Los dos últimos meses (incluido el actual) para los chips de "¿Cuándo fuiste?".
List<DateTime> mesesRecientes(DateTime hoy) => [DateTime(hoy.year, hoy.month, 1), DateTime(hoy.year, hoy.month - 1, 1)];

bool mismoMes(DateTime? a, DateTime b) => a != null && a.year == b.year && a.month == b.month;
