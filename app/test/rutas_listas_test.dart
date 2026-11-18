import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/features/listas/formulario_lista.dart';
import 'package:travel_oaxaca_app/features/listas/modelos.dart';
import 'package:travel_oaxaca_app/features/listas/utiles.dart';
import 'package:travel_oaxaca_app/features/rutas/modelos.dart';
import 'package:travel_oaxaca_app/features/rutas/utiles.dart';

void main() {
  group('rutas', () {
    test('textoDuracion', () {
      expect(textoDuracion(null), '');
      expect(textoDuracion(0.5), '30 min');
      expect(textoDuracion(3), '3 h');
      expect(textoDuracion(1.5), '1 h 30 min');
    });

    test('textoKm', () {
      expect(textoKm(null), '');
      expect(textoKm(62), '62 km');
      expect(textoKm(4.5), '4.5 km');
    });

    test('nombres de dificultad y transporte', () {
      expect(nombreDificultad('facil'), 'Fácil');
      expect(nombreDificultad('x'), '');
      expect(nombreTransporte('a_pie'), 'A pie');
      expect(nombreTransporte(null), '');
    });

    test('RutaDetalle ordena las paradas y detecta coordenadas', () {
      final r = RutaDetalle.desdeJson({
        'id': '1',
        'slug': 'centro',
        'nombre': 'Centro histórico',
        'duracionHoras': 3,
        'esPremium': true,
        'paradas': [
          {'orden': 2, 'tipo': 'negocio', 'nombre': 'B', 'slug': 'b', 'minutosEstimados': 45},
          {'orden': 1, 'tipo': 'lugar', 'nombre': 'A', 'slug': 'a', 'latitud': 17.06, 'longitud': -96.72},
        ],
      });
      expect(r.tarjeta.esPremium, isTrue);
      expect(r.paradas.map((p) => p.nombre), ['A', 'B']);
      expect(r.paradas.first.tieneCoordenadas, isTrue);
      expect(r.paradas.last.tieneCoordenadas, isFalse);
      expect(subtituloParada(r.paradas.last), 'Negocio · 45 min');
    });
  });

  group('listas', () {
    test('textoFechas', () {
      expect(textoFechas(null, null), '');
      expect(textoFechas(DateTime(2026, 12, 15), DateTime(2026, 12, 17)), '15 – 17 dic 2026');
      expect(textoFechas(DateTime(2026, 12, 28), DateTime(2027, 1, 2)), '28 dic 2026 – 2 ene 2027');
      expect(textoFechas(DateTime(2026, 12, 15), DateTime(2026, 12, 15)), '15 dic 2026');
    });

    test('diasDeItinerario', () {
      expect(diasDeItinerario(null, null, const []), 1);
      expect(diasDeItinerario(DateTime(2026, 12, 15), DateTime(2026, 12, 17), const []), 3);
      expect(diasDeItinerario(null, null, const [1, 4]), 4);
      expect(diasDeItinerario(DateTime(2026, 12, 15), DateTime(2026, 12, 16), const [5]), 5);
    });

    test('ListaDetalle agrupa por día y ordena', () {
      final l = ListaDetalle.desdeJson({
        'id': 'l',
        'nombre': 'Viaje',
        'esItinerario': true,
        'fechaInicio': '2026-12-15',
        'fechaFin': '2026-12-16',
        'elementos': [
          {'itemId': 'a', 'tipo': 'lugar', 'id': '1', 'nombre': 'A', 'dia': 1, 'orden': 1},
          {'itemId': 'b', 'tipo': 'negocio', 'id': '2', 'nombre': 'B', 'dia': 1, 'orden': 0},
          {'itemId': 'c', 'tipo': 'ruta', 'id': '3', 'nombre': 'C', 'dia': 2, 'orden': 0},
        ],
      });
      expect(l.totalDias, 2);
      expect(l.delDia(1).map((e) => e.itemId), ['b', 'a']);
      expect(l.delDia(2).single.itemId, 'c');
    });

    test('fechaIso y rutaDeItem', () {
      expect(fechaIso(DateTime(2026, 3, 5)), '2026-03-05');
      expect(rutaDeItem('ruta', 'centro'), '/ruta/centro');
      expect(rutaDeItem('lugar', null), isNull);
      expect(rutaDeItem('otro', 'x'), isNull);
    });

    test('validarFechas', () {
      expect(validarFechas(null, null), isNull);
      expect(validarFechas(DateTime(2026, 12, 15), DateTime(2026, 12, 14)), isNotNull);
      expect(validarFechas(DateTime(2026, 12, 15), null), isNotNull);
      expect(validarFechas(DateTime(2026, 12, 15), DateTime(2026, 12, 15)), isNull);
    });
  });
}
