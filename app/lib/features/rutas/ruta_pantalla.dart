import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../core/api/respuesta.dart';
import '../../core/enlaces.dart';
import '../../core/tema.dart';
import '../detalle/widgets.dart' show BotonCorazon, BotonVidrio;
import '../explorar/widgets.dart' show EstadoVacio;
import '../listas/guardar_en.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

class RutaPantalla extends ConsumerWidget {
  const RutaPantalla({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(rutaProvider(slug));
    return d.when(
      loading: () => const Scaffold(backgroundColor: Colores.crema, body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        backgroundColor: Colores.crema,
        appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.pop())),
        body: EstadoVacio(
          icono: Icons.cloud_off,
          titulo: 'No pudimos cargar la ruta',
          texto: ErrorApi.desde(e).general,
          accion: () => ref.invalidate(rutaProvider(slug)),
        ),
      ),
      data: (r) => _Contenido(ruta: r),
    );
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({required this.ruta});
  final RutaDetalle ruta;

  List<Parada> get _conCoord => ruta.paradas.where((p) => p.tieneCoordenadas).toList();

  @override
  Widget build(BuildContext context) {
    final t = ruta.tarjeta;
    final arriba = MediaQuery.of(context).padding.top;
    final primera = _conCoord.isEmpty ? null : _conCoord.first;
    return Scaffold(
      backgroundColor: Colores.crema,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Stack(
              children: [
                PortadaRuta(ruta: t, alto: 220 + arriba, icono: 54),
                Positioned(left: 14, top: arriba + 10, child: BotonVidrio(icono: Icons.arrow_back_ios_new, alTocar: () => context.canPop() ? context.pop() : context.go('/explorar'))),
                Positioned(
                  right: 14,
                  top: arriba + 10,
                  child: Row(
                    children: [
                      BotonGuardarEn(tipo: 'ruta', id: t.id, nombre: t.nombre),
                      const SizedBox(width: 10),
                      BotonCorazon(tipo: 'ruta', id: t.id, nombre: t.nombre, slug: t.slug, tam: 42),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (t.esPremium) ...[
                    const PildoraRuta('★ Premium', fondo: Colores.tinta, color: Colores.maiz),
                    const SizedBox(height: 8),
                  ],
                  Text(t.nombre, style: titulo(26)),
                  const SizedBox(height: 10),
                  DatosRuta(ruta: t),
                  if ((t.descripcion ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text(t.descripcion!.trim(), style: const TextStyle(fontSize: 14.5, height: 1.5)),
                  ],
                  const SizedBox(height: 18),
                  _Estadisticas(ruta: ruta),
                  if (_conCoord.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text('El recorrido', style: titulo(19)),
                    const SizedBox(height: 10),
                    _MapaRuta(paradas: _conCoord),
                  ],
                  const SizedBox(height: 24),
                  Text('Paradas', style: titulo(19)),
                  const SizedBox(height: 12),
                  if (ruta.paradas.isEmpty)
                    const Text('Esta ruta aún no tiene paradas.', style: TextStyle(color: Colores.suave))
                  else
                    for (var i = 0; i < ruta.paradas.length; i++) _FilaParada(numero: i + 1, parada: ruta.paradas[i], ultima: i == ruta.paradas.length - 1),
                  const SizedBox(height: 110),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _BarraInferior(ruta: t, primera: primera),
    );
  }
}

class _Estadisticas extends StatelessWidget {
  const _Estadisticas({required this.ruta});
  final RutaDetalle ruta;

  @override
  Widget build(BuildContext context) {
    final t = ruta.tarjeta;
    final datos = <(String, String)>[
      if (textoDuracion(t.duracionHoras).isNotEmpty) ('Duración', textoDuracion(t.duracionHoras)),
      if (textoKm(t.distanciaKm).isNotEmpty) ('Distancia', textoKm(t.distanciaKm)),
      ('Paradas', '${ruta.paradas.length}'),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colores.linea)),
      child: Row(
        children: [
          for (final d in datos)
            Expanded(
              child: Column(
                children: [
                  Text(d.$2, style: titulo(18)),
                  const SizedBox(height: 3),
                  Text(d.$1, style: const TextStyle(fontSize: 12, color: Colores.suave)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _MapaRuta extends StatelessWidget {
  const _MapaRuta({required this.paradas});
  final List<Parada> paradas;

  @override
  Widget build(BuildContext context) {
    final puntos = [for (final p in paradas) LatLng(p.latitud!, p.longitud!)];
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        height: 230,
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: puntos.length > 1 ? const LatLng(17.0654, -96.7236) : puntos.first,
                initialZoom: 13,
                interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                initialCameraFit: puntos.length > 1
                    ? CameraFit.coordinates(coordinates: puntos, padding: const EdgeInsets.all(36), maxZoom: 16)
                    : null,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'mx.com.traveloaxaca.travel_oaxaca_app',
                  maxNativeZoom: 19,
                ),
                if (puntos.length > 1) PolylineLayer(polylines: [Polyline(points: puntos, strokeWidth: 4, color: Colores.grana.withValues(alpha: 0.85))]),
                MarkerLayer(
                  markers: [
                    for (var i = 0; i < puntos.length; i++)
                      Marker(
                        point: puntos[i],
                        width: 30,
                        height: 30,
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colores.grana,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const Positioned(
              right: 6,
              bottom: 4,
              child: Text('© OpenStreetMap', style: TextStyle(fontSize: 10, color: Colores.suave, backgroundColor: Color(0xCCFFFFFF))),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilaParada extends StatelessWidget {
  const _FilaParada({required this.numero, required this.parada, required this.ultima});
  final int numero;
  final Parada parada;
  final bool ultima;

  String? get _destino => switch (parada.tipo) {
        'lugar' when (parada.slug ?? '').isNotEmpty => '/lugar/${parada.slug}',
        'negocio' when (parada.slug ?? '').isNotEmpty => '/negocio/${parada.slug}',
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final destino = _destino;
    final nombre = (parada.nombre ?? '').trim().isEmpty ? 'Parada $numero' : parada.nombre!.trim();
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 38,
            child: Column(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: Colores.grana, shape: BoxShape.circle),
                  child: Text('$numero', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                ),
                if (!ultima) Expanded(child: Container(width: 2, color: Colores.linea)),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: ultima ? 0 : 12),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: destino == null ? null : () => context.push(destino),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Colores.linea)),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(nombre, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                              const SizedBox(height: 2),
                              Text(subtituloParada(parada), style: const TextStyle(color: Colores.suave, fontSize: 12.5)),
                            ],
                          ),
                        ),
                        if (destino != null) const Icon(Icons.chevron_right, color: Colores.suave),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarraInferior extends ConsumerWidget {
  const _BarraInferior({required this.ruta, required this.primera});
  final RutaTarjeta ruta;
  final Parada? primera;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colores.linea))),
        child: Row(
          children: [
            if (primera != null) ...[
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => Enlaces.comoLlegar(context, primera!.latitud!, primera!.longitud!),
                  icon: const Icon(Icons.directions_outlined, size: 20),
                  label: const Text('Cómo llegar'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colores.tinta,
                    side: const BorderSide(color: Colores.linea, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                    textStyle: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: SizedBox(
                height: 52,
                child: FilledButton(
                  onPressed: () => mostrarGuardarEn(context, ref, tipo: 'ruta', id: ruta.id, nombre: ruta.nombre),
                  style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                  child: const Text('＋ Agregar a mi itinerario', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
