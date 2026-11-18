import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Abre otras apps: WhatsApp, teléfono y mapas.
class Enlaces {
  static Future<void> _abrir(BuildContext context, Uri uri, String falla) async {
    var ok = false;
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(falla)));
    }
  }

  /// Deja solo los dígitos; con 10 dígitos agrega el 52 de México.
  static String soloDigitos(String valor) {
    var d = valor.replaceAll(RegExp(r'[^0-9]'), '');
    if (d.length == 10) d = '52$d';
    return d;
  }

  static Future<void> whatsapp(BuildContext context, String numero, String negocio) {
    final texto = Uri.encodeComponent('Hola, vi $negocio en Travel Oaxaca y me gustaría más información.');
    return _abrir(context, Uri.parse('https://wa.me/${soloDigitos(numero)}?text=$texto'), 'No pudimos abrir WhatsApp.');
  }

  static Future<void> llamar(BuildContext context, String numero) {
    final limpio = numero.replaceAll(RegExp(r'[^0-9+]'), '');
    return _abrir(context, Uri(scheme: 'tel', path: limpio), 'No pudimos abrir el teléfono.');
  }

  static Future<void> comoLlegar(BuildContext context, double lat, double lng) {
    return _abrir(
      context,
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'),
      'No pudimos abrir el mapa.',
    );
  }

  static Future<void> web(BuildContext context, String url) {
    final u = url.startsWith('http') ? url : 'https://$url';
    return _abrir(context, Uri.parse(u), 'No pudimos abrir la página.');
  }
}
