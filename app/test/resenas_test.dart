import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/features/detalle/modelos.dart';
import 'package:travel_oaxaca_app/features/resenas/utiles.dart';

void main() {
  test('nombreCorto igual que la API', () {
    expect(nombreCorto('Prudens Velasco Palacios'), 'Prudens V.');
    expect(nombreCorto('  ana  '), 'ana');
    expect(nombreCorto(''), 'Viajero');
    expect(nombreCorto('juan pérez'), 'juan P.');
  });

  test('textoValido pide 20 a 2000 caracteres sin contar espacios de los lados', () {
    expect(textoValido('corto'), isFalse);
    expect(textoValido('   ${'a' * 19}   '), isFalse);
    expect(textoValido('a' * 20), isTrue);
    expect(textoValido('a' * 2001), isFalse);
  });

  test('mesesRecientes cruza el año', () {
    final m = mesesRecientes(DateTime(2027, 1, 20));
    expect(m[0], DateTime(2027, 1, 1));
    expect(m[1], DateTime(2026, 12, 1));
  });

  test('fechas en español', () {
    expect(mesAnio(DateTime(2026, 11, 3)), 'nov 2026');
    expect(fechaCorta(DateTime(2026, 10, 15)), '15 oct 2026');
    expect(etiquetaCalificacion(4), 'Muy bueno');
    expect(etiquetaCalificacion(0), 'Toca una estrella');
  });

  test('MiResena lee la respuesta de GET /mi/resenas', () {
    final m = MiResena.desdeJson({
      'resena': {'id': 'r1', 'calificacion': 4, 'titulo': 'Bien', 'texto': 'x' * 25, 'fechaVisita': '2026-11-01', 'estado': 'pendiente'},
      'negocioId': 'n1',
      'negocioSlug': 'casa-azul',
      'negocioNombre': 'Casa Azul',
      'categoriaClave': 'hospedaje',
      'municipioNombre': 'Oaxaca de Juárez',
    });
    expect(m.resena.calificacion, 4);
    expect(m.resena.pendiente, isTrue);
    expect(m.resena.fechaVisita, DateTime(2026, 11, 1));
    expect(m.negocioSlug, 'casa-azul');
    expect(ResenaPropia.desdeJson({'id': 'a', 'calificacion': 2, 'estado': 'rechazada'}).noPublicada, isTrue);
  });
}
