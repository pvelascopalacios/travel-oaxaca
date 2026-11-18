import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Centro de Oaxaca de Juárez: se usa cuando no hay ubicación del teléfono.
const centroOaxaca = LatLng(17.0732, -96.7266);

enum PermisoUbicacion {
  /// Aún no le preguntamos a la persona.
  sinPreguntar,
  concedido,
  denegado,

  /// Android ya no vuelve a preguntar: hay que activarlo en Ajustes.
  denegadoSiempre,
  servicioApagado,
}

class EstadoUbicacion {
  const EstadoUbicacion({this.permiso = PermisoUbicacion.sinPreguntar, this.punto, this.buscando = false});

  final PermisoUbicacion permiso;
  final LatLng? punto;
  final bool buscando;

  bool get tienePunto => punto != null;
}

/// "350 m" o "1.2 km".
String textoDistancia(int metros) => metros < 1000 ? '$metros m' : '${(metros / 1000).toStringAsFixed(1)} km';

/// Radio (km) que cubre la parte visible del mapa: del centro a una esquina, entre 1 y 100.
double radioParaVista(LatLng centro, LatLng esquina) {
  final km = const Distance().as(LengthUnit.Kilometer, centro, esquina).toDouble();
  final redondeado = km.ceilToDouble();
  return redondeado.clamp(1, 100).toDouble();
}

/// Zoom del mapa que más o menos abarca un radio en km (pantalla de teléfono).
double zoomParaRadio(double radioKm) {
  if (radioKm <= 1) return 15;
  if (radioKm <= 2) return 14;
  if (radioKm <= 5) return 12.5;
  if (radioKm <= 10) return 12;
  if (radioKm <= 25) return 11;
  if (radioKm <= 50) return 10;
  return 9;
}

class UbicacionNotifier extends Notifier<EstadoUbicacion> {
  @override
  EstadoUbicacion build() {
    _revisarSilencioso();
    return const EstadoUbicacion();
  }

  /// Si ya había permiso, toma la ubicación sin mostrar ningún aviso.
  Future<void> _revisarSilencioso() async {
    try {
      final permiso = await Geolocator.checkPermission();
      if (permiso == LocationPermission.always || permiso == LocationPermission.whileInUse) {
        await _tomarPunto();
      } else if (permiso == LocationPermission.deniedForever) {
        state = const EstadoUbicacion(permiso: PermisoUbicacion.denegadoSiempre);
      }
    } catch (_) {
      // Sin plugin o sin servicio: se queda en "sin preguntar".
    }
  }

  /// Pide el permiso (si hace falta) y la ubicación. Lo llama el botón "Activar ubicación".
  Future<void> activar() async {
    state = EstadoUbicacion(permiso: state.permiso, punto: state.punto, buscando: true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        state = const EstadoUbicacion(permiso: PermisoUbicacion.servicioApagado);
        return;
      }
      var permiso = await Geolocator.checkPermission();
      if (permiso == LocationPermission.denied) {
        permiso = await Geolocator.requestPermission();
      }
      if (permiso == LocationPermission.deniedForever) {
        state = const EstadoUbicacion(permiso: PermisoUbicacion.denegadoSiempre);
      } else if (permiso == LocationPermission.denied) {
        state = const EstadoUbicacion(permiso: PermisoUbicacion.denegado);
      } else {
        await _tomarPunto();
      }
    } catch (_) {
      state = const EstadoUbicacion(permiso: PermisoUbicacion.denegado);
    }
  }

  /// Vuelve a leer dónde estamos (botón de centrar).
  Future<void> actualizar() async {
    if (state.permiso != PermisoUbicacion.concedido) {
      await activar();
      return;
    }
    try {
      await _tomarPunto();
    } catch (_) {}
  }

  Future<void> _tomarPunto() async {
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 12)),
    );
    state = EstadoUbicacion(permiso: PermisoUbicacion.concedido, punto: LatLng(p.latitude, p.longitude));
  }

  Future<void> abrirAjustes() => Geolocator.openAppSettings();

  Future<void> abrirAjustesUbicacion() => Geolocator.openLocationSettings();
}

final ubicacionProvider = NotifierProvider<UbicacionNotifier, EstadoUbicacion>(UbicacionNotifier.new);
