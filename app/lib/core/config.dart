import 'dart:io' show Platform;

/// Dirección de la API. En el emulador de Android, 10.0.2.2 es tu PC; en el simulador de iPhone es localhost.
/// Para otra dirección (p. ej. un teléfono real): flutter run --dart-define=API_URL=http://192.168.1.10:8081/api/v1
class Config {
  static const String _apiUrlCompilada = String.fromEnvironment('API_URL');
  static String get apiUrl =>
      _apiUrlCompilada.isNotEmpty ? _apiUrlCompilada : (Platform.isIOS ? 'http://localhost:8081/api/v1' : 'http://10.0.2.2:8081/api/v1');

  /// Páginas con el texto legal. Se pasan al compilar:
  /// flutter run --dart-define=URL_TERMINOS=https://... --dart-define=URL_PRIVACIDAD=https://...
  static const String urlTerminos = String.fromEnvironment('URL_TERMINOS');
  static const String urlPrivacidad = String.fromEnvironment('URL_PRIVACIDAD');
}

/// Las fotos pueden venir con "localhost" o con una ruta relativa; esto las vuelve
/// direcciones que el emulador sí alcanza (usa el mismo servidor que la API).
String? urlImagen(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final api = Uri.parse(Config.apiUrl);
  final u = Uri.tryParse(url.trim());
  if (u == null) return null;
  if (!u.hasScheme) {
    final ruta = url.startsWith('/') ? url : '/$url';
    return '${api.scheme}://${api.host}:${api.port}$ruta';
  }
  if (u.host == 'localhost' || u.host == '127.0.0.1' || u.host == '10.0.2.2') {
    return u.replace(host: api.host, port: api.port, scheme: api.scheme).toString();
  }
  return url;
}
