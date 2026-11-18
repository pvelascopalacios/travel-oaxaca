import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/features/cuenta/modelos.dart';
import 'package:travel_oaxaca_app/features/cuenta/utiles.dart';

void main() {
  test('fuerzaClave orienta pero la API exige 10', () {
    expect(fuerzaClave(''), 0);
    expect(fuerzaClave('corta1'), 1);
    expect(fuerzaClave('todaminuscula'), 2);
    expect(fuerzaClave('Mezcla123abc'), 3);
    expect(fuerzaClave('Mezcla123abc!xyz'), 4);
    expect(textoFuerza('abc'), contains('mínimo 10'));
  });

  test('teléfono mexicano a E.164 y de vuelta', () {
    expect(telefonoE164Mexico(''), isNull);
    expect(telefonoE164Mexico('954 123 4567'), '+529541234567');
    expect(telefonoE164Mexico('+52 954 123 4567'), '+529541234567');
    expect(telefonoParaMostrar('+529541234567'), '954 123 4567');
    expect(telefonoParaMostrar(null), '');
    expect(telefonoValido(''), isTrue);
    expect(telefonoValido('954 123 4567'), isTrue);
    expect(telefonoValido('12345'), isFalse);
  });

  test('textoAbierta dice hoy, ayer o la fecha', () {
    final ahora = DateTime(2026, 11, 17, 13, 0);
    expect(textoAbierta(DateTime(2026, 11, 17, 9, 5), ahora), 'hoy, 09:05');
    expect(textoAbierta(DateTime(2026, 11, 16, 22, 30), ahora), 'ayer, 22:30');
    expect(textoAbierta(DateTime(2026, 11, 3), ahora), '3 nov');
    expect(textoAbierta(DateTime(2025, 11, 3), ahora), '3 nov 2025');
  });

  test('SesionActiva y su título', () {
    final s = SesionActiva.desdeJson({'id': 'a', 'plataforma': 'android', 'versionApp': '1.0.0', 'creadoEn': '2026-11-17T12:30:00Z', 'actual': true});
    expect(s.actual, isTrue);
    expect(tituloSesion(s), 'Android · app 1.0.0');
    expect(tituloSesion(SesionActiva.desdeJson({'id': 'b', 'plataforma': 'web'})), 'Navegador web');
  });

  test('ultimoPorTipo se queda con el más reciente de cada tipo', () {
    final h = [
      Consentimiento.desdeJson({'tipo': 'analitica', 'versionTexto': '1', 'aceptado': false, 'fecha': '2026-11-16T10:00:00Z'}),
      Consentimiento.desdeJson({'tipo': 'analitica', 'versionTexto': '1', 'aceptado': true, 'fecha': '2026-11-12T10:00:00Z'}),
      Consentimiento.desdeJson({'tipo': 'terminos', 'versionTexto': '1.0', 'aceptado': true, 'fecha': '2026-11-12T10:00:00Z'}),
    ];
    final u = ultimoPorTipo(h);
    expect(u['analitica']!.aceptado, isFalse);
    expect(u['terminos']!.versionTexto, '1.0');
    expect(u['marketing'], isNull);
  });

  test('solicitud abierta y perfil a usuario', () {
    expect(SolicitudPrivacidad.desdeJson({'id': 'x', 'tipo': 'acceso', 'estado': 'en_proceso'}).abierta, isTrue);
    expect(SolicitudPrivacidad.desdeJson({'id': 'x', 'tipo': 'acceso', 'estado': 'resuelta'}).abierta, isFalse);
    final p = PerfilCuenta.desdeJson({'id': 'u', 'correo': 'a@b.com', 'nombre': 'Ana', 'telefonoE164': '+529541234567', 'idiomaCodigo': 'es', 'correoVerificado': true, 'roles': ['turista']});
    expect(p.aUsuario().correoVerificado, isTrue);
    expect(p.telefonoE164, '+529541234567');
    expect(estadoSolicitud('en_proceso'), 'En trámite');
    expect(nombreDerecho('cancelacion'), 'Borrar mi cuenta y datos');
  });
}
