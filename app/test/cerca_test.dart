import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:travel_oaxaca_app/features/cerca/datos_cerca.dart';
import 'package:travel_oaxaca_app/features/cerca/ubicacion.dart';
import 'package:travel_oaxaca_app/features/explorar/modelos.dart';

void main() {
  test('textoDistancia usa metros o kilometros', () {
    expect(textoDistancia(350), '350 m');
    expect(textoDistancia(1200), '1.2 km');
  });

  test('textoAPie solo hasta 3 km y nunca menos de 1 minuto', () {
    expect(textoAPie(null), isNull);
    expect(textoAPie(3500), isNull);
    expect(textoAPie(10), 'a pie 1 min');
    expect(textoAPie(320), 'a pie 4 min');
  });

  test('zoomParaRadio crece al achicar el radio', () {
    expect(zoomParaRadio(1), greaterThan(zoomParaRadio(5)));
    expect(zoomParaRadio(5), greaterThan(zoomParaRadio(25)));
    expect(zoomParaRadio(80), 9);
  });

  test('radioParaVista queda entre 1 y 100 km', () {
    const centro = LatLng(17.0732, -96.7266);
    expect(radioParaVista(centro, const LatLng(17.0735, -96.7266)), 1);
    expect(radioParaVista(centro, const LatLng(17.0732 + 3, -96.7266)), 100);
  });

  test('NegocioTarjeta lee latitud y longitud', () {
    final n = NegocioTarjeta.desdeJson({'id': 'a', 'slug': 's', 'nombre': 'N', 'latitud': 17.06, 'longitud': -96.72});
    expect(n.tieneCoordenadas, isTrue);
    final sin = NegocioTarjeta.desdeJson({'id': 'a', 'slug': 's', 'nombre': 'N'});
    expect(sin.tieneCoordenadas, isFalse);
  });

  test('ConsultaCerca compara sin importar el orden de las categorias', () {
    const a = ConsultaCerca(lat: 1, lng: 2, radioKm: 5, categoriaIds: ['x', 'y']);
    const b = ConsultaCerca(lat: 1, lng: 2, radioKm: 5, categoriaIds: ['y', 'x']);
    expect(a, b);
    expect(a.hashCode, b.hashCode);
    expect(a == const ConsultaCerca(lat: 1, lng: 2, radioKm: 10, categoriaIds: ['x', 'y']), isFalse);
  });
}
