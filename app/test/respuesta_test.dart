import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/core/api/respuesta.dart';
import 'package:travel_oaxaca_app/core/sesion/modelos.dart';

void main() {
  group('ApiRespuesta', () {
    test('lee ok, datos, mensajes y errores', () {
      final r = ApiRespuesta.desdeJson({
        'ok': false,
        'datos': null,
        'mensajes': ['Revisa los datos.'],
        'errores': {'correo': 'Escribe un correo válido.'},
      });
      expect(r.ok, isFalse);
      expect(r.mensajes.first, 'Revisa los datos.');
      expect(r.errores['correo'], 'Escribe un correo válido.');
    });

    test('una respuesta que no es un mapa no revienta', () {
      final r = ApiRespuesta.desdeJson('hola');
      expect(r.ok, isFalse);
      expect(r.mensajes, isNotEmpty);
    });
  });

  group('ErrorApi', () {
    DioException conRespuesta(int codigo, dynamic datos) {
      final req = RequestOptions(path: '/auth/ingreso');
      return DioException(
        requestOptions: req,
        response: Response(requestOptions: req, statusCode: codigo, data: datos),
      );
    }

    test('usa el primer mensaje y los errores por campo de la API', () {
      final e = ErrorApi.desde(conRespuesta(400, {
        'ok': false,
        'mensajes': ['Escribe tu correo.'],
        'errores': {'correo': 'Escribe tu correo.'},
      }));
      expect(e.general, 'Escribe tu correo.');
      expect(e.campos['correo'], 'Escribe tu correo.');
      expect(e.codigo, 400);
    });

    test('sin mensajes usa un texto por código', () {
      expect(ErrorApi.desde(conRespuesta(404, {'ok': false})).general, 'No encontramos lo que buscas.');
    });

    test('sin respuesta del servidor avisa de la conexión', () {
      final e = ErrorApi.desde(DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError,
      ));
      expect(e.general, contains('conectar'));
    });
  });

  group('Usuario', () {
    test('lee lo que manda la API y vuelve a convertirse a JSON', () {
      final u = Usuario.desdeJson({
        'id': 'u1',
        'correo': 'a@b.mx',
        'nombre': 'Clara Velasco',
        'idiomaCodigo': 'es',
        'correoVerificado': false,
        'roles': ['TURISTA'],
      });
      expect(u.primerNombre, 'Clara');
      expect(u.inicial, 'C');
      expect(Usuario.desdeJson(u.aJson()).correo, 'a@b.mx');
    });
  });
}
