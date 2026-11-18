import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/core/enlaces.dart';
import 'package:travel_oaxaca_app/features/detalle/modelos.dart';

void main() {
  final json = {
    'id': 'n1',
    'slug': 'casa-azul',
    'nombre': 'Casa Azul',
    'categoriaNombre': 'Hotel',
    'precioDesde': 850,
    'verificado': true,
    'calificacionPromedio': 4.8,
    'totalResenas': 126,
    'sucursales': [
      {
        'nombre': 'Centro',
        'esPrincipal': true,
        'municipioNombre': 'Oaxaca de Juárez',
        'latitud': 17.06,
        'longitud': -96.72,
        'abiertoAhora': true,
        'horarios': [
          {'diaSemana': 1, 'abre': '07:00', 'cierra': '22:00', 'cerrado': false},
          {'diaSemana': 0, 'cerrado': true},
        ],
      }
    ],
    'contactos': [
      {'tipo': 'telefono', 'valor': '951 123 4567', 'esPrincipal': false},
      {'tipo': 'whatsapp', 'valor': '951 123 4567', 'esPrincipal': true},
    ],
    'fotos': [
      {'url': 'http://localhost:9000/a.jpg', 'esPortada': true},
      {'url': '', 'esPortada': false},
    ],
    'ofertas': [
      {'id': 'o1', 'tipo': 'habitacion', 'nombre': 'Doble', 'precioDesde': 850, 'capacidad': 2},
    ],
    'posicion': {'posicion': 4, 'total': 86, 'municipioNombre': 'Oaxaca de Juárez'},
  };

  test('NegocioDetalle lee la ficha completa', () {
    final n = NegocioDetalle.desdeJson(json);
    expect(n.subtitulo, 'Hotel · Oaxaca de Juárez');
    expect(n.precioTexto, '\$850');
    expect(n.fotos.length, 1);
    expect(n.contacto('whatsapp'), '951 123 4567');
    expect(n.contacto('web'), isNull);
    expect(n.cierraHoy(1), '22:00');
    expect(n.cierraHoy(0), isNull);
    expect(n.posicion, 4);
    expect(n.principal!.tieneCoordenadas, isTrue);
    expect(n.ofertas.first.detalle, '2 personas');
  });

  test('ResenasPublicas lee promedio y distribución', () {
    final r = ResenasPublicas.desdeJson({
      'resenas': {
        'elementos': [
          {'id': 'r1', 'calificacion': 5, 'autorNombre': 'Marisol', 'texto': 'Muy bien', 'respuesta': {'texto': 'Gracias'}}
        ]
      },
      'calificacion': {
        'promedio': 4.8,
        'total': 126,
        'distribucion': {'5': 100, '4': 20}
      },
    });
    expect(r.total, 126);
    expect(r.distribucion[5], 100);
    expect(r.resenas.first.respuesta, 'Gracias');
  });

  test('el número de WhatsApp se limpia y agrega el 52', () {
    expect(Enlaces.soloDigitos('951 123 4567'), '529511234567');
    expect(Enlaces.soloDigitos('+52 1 951 123 4567'), '5219511234567');
  });
}
