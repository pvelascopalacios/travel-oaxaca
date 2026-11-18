import 'modelos.dart';

const claveMinima = 10;

/// 0 a 4 según largo y variedad. La API solo exige 10 caracteres; esto solo orienta.
int fuerzaClave(String c) {
  if (c.isEmpty) return 0;
  if (c.runes.length < claveMinima) return 1;
  var puntos = 2;
  final variedad = [RegExp(r'[a-z]'), RegExp(r'[A-Z]'), RegExp(r'[0-9]'), RegExp(r'[^A-Za-z0-9]')].where((r) => r.hasMatch(c)).length;
  if (variedad >= 3) puntos++;
  if (c.runes.length >= 14 && variedad >= 3) puntos++;
  return puntos.clamp(1, 4);
}

String textoFuerza(String c) => switch (fuerzaClave(c)) {
      0 => '',
      1 => c.runes.length < claveMinima ? 'Muy corta: mínimo $claveMinima caracteres.' : 'Débil.',
      2 => 'Aceptable. Mezcla letras, números y un símbolo para hacerla más fuerte.',
      3 => 'Buena.',
      _ => 'Muy buena.',
    };

/// Pasa "954 123 4567" a "+529541234567". Vacío = sin teléfono (null).
String? telefonoE164Mexico(String texto) {
  final d = texto.replaceAll(RegExp(r'[^0-9]'), '');
  if (d.isEmpty) return null;
  final sin52 = d.length == 12 && d.startsWith('52') ? d.substring(2) : d;
  return '+52$sin52';
}

/// De "+529541234567" a "954 123 4567" (si no es de México, lo deja como viene sin el +).
String telefonoParaMostrar(String? e164) {
  if (e164 == null || e164.isEmpty) return '';
  if (e164.startsWith('+52') && e164.length == 13) {
    final n = e164.substring(3);
    return '${n.substring(0, 3)} ${n.substring(3, 6)} ${n.substring(6)}';
  }
  return e164.replaceFirst('+', '');
}

/// Un teléfono mexicano de 10 dígitos (o vacío).
bool telefonoValido(String texto) {
  final d = texto.replaceAll(RegExp(r'[^0-9]'), '');
  return d.isEmpty || d.length == 10 || (d.length == 12 && d.startsWith('52'));
}

const _meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

String _hhmm(DateTime f) => '${f.hour.toString().padLeft(2, '0')}:${f.minute.toString().padLeft(2, '0')}';

/// "hoy, 12:30" / "ayer" / "12 nov" / "12 nov 2025".
String textoAbierta(DateTime f, DateTime ahora) {
  final hoy = DateTime(ahora.year, ahora.month, ahora.day);
  final dia = DateTime(f.year, f.month, f.day);
  final dif = hoy.difference(dia).inDays;
  if (dif == 0) return 'hoy, ${_hhmm(f)}';
  if (dif == 1) return 'ayer, ${_hhmm(f)}';
  final base = '${f.day} ${_meses[f.month - 1]}';
  return f.year == ahora.year ? base : '$base ${f.year}';
}

String fechaLarga(DateTime f) => '${f.day} ${_meses[f.month - 1]} ${f.year}';

String nombrePlataforma(String p) => switch (p) {
      'android' => 'Android',
      'ios' => 'iPhone',
      'web' => 'Navegador web',
      _ => 'Dispositivo',
    };

String tituloSesion(SesionActiva s) =>
    s.plataforma == 'web' || s.versionApp == null ? nombrePlataforma(s.plataforma) : '${nombrePlataforma(s.plataforma)} · app ${s.versionApp}';

String nombreDerecho(String tipo) => switch (tipo) {
      'acceso' => 'Saber qué datos tenemos',
      'rectificacion' => 'Corregir mis datos',
      'cancelacion' => 'Borrar mi cuenta y datos',
      'oposicion' => 'Limitar el uso de mis datos',
      _ => tipo,
    };

String estadoSolicitud(String e) => switch (e) {
      'recibida' => 'Recibida',
      'en_proceso' => 'En trámite',
      'resuelta' => 'Resuelta',
      'rechazada' => 'No procedió',
      _ => e,
    };
