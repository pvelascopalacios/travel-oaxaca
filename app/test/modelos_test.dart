import 'package:flutter_test/flutter_test.dart';
import 'package:travel_oaxaca_app/core/config.dart';
import 'package:travel_oaxaca_app/features/explorar/modelos.dart';

void main() {
  test('NegocioTarjeta lee la respuesta y arma textos', () {
    final n = NegocioTarjeta.desdeJson({
      'id': 'a',
      'slug': 'casa-azul',
      'nombre': 'Casa Azul',
      'categoriaNombre': 'Hotel',
      'municipioNombre': 'Oaxaca de Juárez',
      'precioDesde': 850,
      'rangoPrecio': 2,
      'distanciaM': 1100,
      'abiertoAhora': true,
      'calificacionPromedio': 4.8,
      'totalResenas': 126,
      'verificado': true,
    });
    expect(n.precioTexto, 'Desde \$850');
    expect(n.ubicacion, 'Hotel · Oaxaca de Juárez');
    expect(n.distanciaTexto, '1.1 km');
    expect(n.calificacion, 4.8);
  });

  test('sin precio capturado usa el rango en signos de pesos', () {
    final n = NegocioTarjeta.desdeJson({'id': 'a', 'slug': 's', 'nombre': 'X', 'rangoPrecio': 2});
    expect(n.precioTexto, '\$\$');
    expect(n.abiertoAhora, isNull);
  });

  test('Pagina sabe si hay más', () {
    final p = Pagina.desdeJson({'elementos': [], 'total': 30, 'pagina': 0, 'tamano': 12}, NegocioTarjeta.desdeJson);
    expect(p.hayMas, isTrue);
    final q = Pagina.desdeJson({'elementos': [], 'total': 30, 'pagina': 2, 'tamano': 12}, NegocioTarjeta.desdeJson);
    expect(q.hayMas, isFalse);
  });

  test('las facetas se agrupan por categoría principal', () {
    final chips = agruparCategorias([
      const Faceta(categoriaId: '1', clave: 'hospedaje', nombre: 'Hospedaje', total: 0),
      const Faceta(categoriaId: '2', clave: 'hotel', nombre: 'Hotel', padreClave: 'hospedaje', total: 5),
      const Faceta(categoriaId: '3', clave: 'hostal', nombre: 'Hostal', padreClave: 'hospedaje', total: 3),
      const Faceta(categoriaId: '4', clave: 'fonda', nombre: 'Fonda', padreClave: 'comer', total: 2),
    ]);
    expect(chips.first.clave, 'hospedaje');
    expect(chips.first.nombre, 'Hospedaje');
    expect(chips.first.total, 8);
    expect(chips.first.ids.length, 3);
    expect(chips.last.nombre, 'Comer');
  });

  test('los filtros arman la consulta', () {
    final c = const FiltrosNegocios(q: ' mezcal ', abiertoAhora: true, precioMax: 2).aConsulta();
    expect(c['q'], 'mezcal');
    expect(c['abiertoAhora'], true);
    expect(c['precioMax'], 2);
    expect(c.containsKey('regionId'), isFalse);
  });

  test('urlImagen cambia localhost por el servidor de la API', () {
    expect(urlImagen('http://localhost:9000/x.jpg'), contains('10.0.2.2'));
    expect(urlImagen('/media/a.jpg'), 'http://10.0.2.2:8081/media/a.jpg');
    expect(urlImagen(null), isNull);
  });

  test('EventoTarjeta arma fechas en español', () {
    final e = EventoTarjeta.desdeJson({
      'id': 'e',
      'slug': 'guelaguetza',
      'nombre': 'Guelaguetza',
      'fechaInicio': '2026-07-20',
      'fechaFin': '2026-07-27',
      'municipioNombre': 'Oaxaca de Juárez',
    });
    expect(e.diaTexto, '20');
    expect(e.mesTexto, 'JUL');
    expect(e.fechasTexto, '20 jul – 27 jul');
    expect(e.lugarTexto, 'Oaxaca de Juárez');
    final uno = EventoTarjeta.desdeJson({'id': 'x', 'slug': 'x', 'nombre': 'X', 'fechaInicio': '2026-12-12', 'fechaFin': '2026-12-12'});
    expect(uno.fechasTexto, '12 dic');
  });
}
