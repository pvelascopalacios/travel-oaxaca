import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/enlaces.dart';
import '../../core/tema.dart';
import '../detalle/widgets.dart' show BotonCorazon;
import '../explorar/modelos.dart';
import '../explorar/repositorio.dart';
import '../explorar/widgets.dart';
import 'datos_cerca.dart';
import 'permiso_vista.dart';
import 'ubicacion.dart';

const _alturaHoja = 84.0;
const _alturaNav = 78.0;

/// Pestaña "Cerca": mapa de OpenStreetMap con los negocios alrededor y una lista que se arrastra.
class CercaPantalla extends ConsumerStatefulWidget {
  const CercaPantalla({super.key});

  @override
  ConsumerState<CercaPantalla> createState() => _CercaPantallaState();
}

class _CercaPantallaState extends ConsumerState<CercaPantalla> {
  final _mapa = MapController();
  final _hoja = DraggableScrollableController();

  bool _omitido = false;
  LatLng? _centroConsulta;
  double? _radio;
  List<String> _categoriaIds = const [];
  bool _abierto = false;
  String? _seleccionId;
  bool _movido = false;
  LatLng? _camCentro;
  LatLng? _camEsquina;
  List<NegocioTarjeta> _ultimos = const [];

  @override
  void dispose() {
    _hoja.dispose();
    _mapa.dispose();
    super.dispose();
  }

  LatLng _centro(EstadoUbicacion u) => _centroConsulta ?? u.punto ?? centroOaxaca;
  double _radioKm(EstadoUbicacion u) => _radio ?? (u.tienePunto ? 5 : 15);

  void _moverMapa(LatLng punto, double zoom) {
    try {
      _mapa.move(punto, zoom);
    } catch (_) {
      // El mapa aún no se dibuja; no pasa nada.
    }
  }

  void _alMoverCamara(MapCamera camara, bool gesto, EstadoUbicacion u) {
    _camCentro = camara.center;
    _camEsquina = camara.visibleBounds.northEast;
    if (!gesto) return;
    final lejos = const Distance().as(LengthUnit.Meter, _centro(u), camara.center) > math.max(500, _radioKm(u) * 350);
    if (lejos != _movido) setState(() => _movido = lejos);
  }

  void _buscarEnZona() {
    final c = _camCentro;
    final e = _camEsquina;
    if (c == null || e == null) return;
    setState(() {
      _centroConsulta = c;
      _radio = radioParaVista(c, e);
      _movido = false;
      _seleccionId = null;
    });
  }

  void _centrar(EstadoUbicacion u) {
    final p = u.punto;
    if (p == null) {
      ref.read(ubicacionProvider.notifier).actualizar();
      return;
    }
    setState(() {
      _centroConsulta = p;
      _radio = 5;
      _movido = false;
    });
    _moverMapa(p, zoomParaRadio(5));
    ref.read(ubicacionProvider.notifier).actualizar();
  }

  void _elegirRadio(double km, EstadoUbicacion u) {
    final c = _centro(u);
    setState(() {
      _centroConsulta = c;
      _radio = km;
      _movido = false;
    });
    _moverMapa(c, zoomParaRadio(km));
  }

  Future<void> _abrirFiltros(EstadoUbicacion u) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
      builder: (ctx) {
        final actual = _radioKm(u);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
                const SizedBox(height: 16),
                Text('Distancia', style: titulo(19)),
                const SizedBox(height: 4),
                const Text('Qué tan lejos buscar desde el centro del mapa.', style: TextStyle(color: Colores.suave)),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final km in const [1.0, 2.0, 5.0, 10.0, 25.0, 50.0])
                      ChoiceChip(
                        label: Text('${km.toInt()} km'),
                        selected: actual == km,
                        selectedColor: Colores.grana,
                        labelStyle: TextStyle(color: actual == km ? Colors.white : Colores.tinta, fontWeight: FontWeight.w700),
                        onSelected: (_) {
                          Navigator.pop(ctx);
                          _elegirRadio(km, u);
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = ref.watch(ubicacionProvider);

    // Cuando llega la ubicación (o se mueve), centramos y buscamos desde ahí.
    ref.listen<EstadoUbicacion>(ubicacionProvider, (anterior, nuevo) {
      if (nuevo.punto != null && anterior?.punto == null) {
        setState(() {
          _centroConsulta = nuevo.punto;
          _radio = 5;
          _movido = false;
          _omitido = false;
        });
        _moverMapa(nuevo.punto!, zoomParaRadio(5));
      }
    });

    if (!u.tienePunto && !_omitido) {
      return PermisoVista(
        estado: u,
        alActivar: () => ref.read(ubicacionProvider.notifier).activar(),
        alOmitir: () => setState(() => _omitido = true),
        alAjustes: () {
          final n = ref.read(ubicacionProvider.notifier);
          u.permiso == PermisoUbicacion.servicioApagado ? n.abrirAjustesUbicacion() : n.abrirAjustes();
        },
      );
    }

    final centro = _centro(u);
    final radio = _radioKm(u);
    final consulta = ConsultaCerca(lat: centro.latitude, lng: centro.longitude, radioKm: radio, categoriaIds: _categoriaIds, abiertoAhora: _abierto);
    final datos = ref.watch(negociosCercaProvider(consulta));
    final cargando = datos.isLoading;
    if (datos.hasValue) _ultimos = datos.value!;

    final lista = _ordenar(_ultimos, u.punto);
    final conCoord = lista.where((n) => n.tieneCoordenadas).toList();
    final seleccion = _seleccionId == null ? null : lista.where((n) => n.id == _seleccionId).firstOrNull;

    final viewPad = MediaQuery.viewPaddingOf(context);
    final navH = viewPad.bottom + _alturaNav;
    final baseInferior = navH + _alturaHoja;

    return Scaffold(
      backgroundColor: Colores.cantera,
      body: Stack(
        children: [
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapa,
              options: MapOptions(
                initialCenter: centro,
                initialZoom: zoomParaRadio(radio),
                minZoom: 5,
                maxZoom: 18,
                interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
                onTap: (_, __) {
                  if (_seleccionId != null) setState(() => _seleccionId = null);
                },
                onPositionChanged: (c, g) => _alMoverCamara(c, g, u),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'mx.com.traveloaxaca.travel_oaxaca_app',
                  maxNativeZoom: 19,
                ),
                MarkerLayer(
                  markers: [
                    for (final n in conCoord)
                      if (n.id != _seleccionId) _marcador(n, false),
                    if (seleccion != null && seleccion.tieneCoordenadas) _marcador(seleccion, true),
                    if (u.punto != null)
                      Marker(point: u.punto!, width: 40, height: 40, child: const _PuntoYo()),
                  ],
                ),
              ],
            ),
          ),

          // Barra superior: búsqueda + filtros + chips.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                    child: Row(
                      children: [
                        Expanded(
                          child: Material(
                            color: Colors.white,
                            elevation: 3,
                            shadowColor: const Color(0x332B2118),
                            borderRadius: BorderRadius.circular(26),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(26),
                              onTap: () => context.push('/buscar'),
                              child: const SizedBox(
                                height: 50,
                                child: Row(
                                  children: [
                                    SizedBox(width: 16),
                                    Icon(Icons.search, color: Colores.suave),
                                    SizedBox(width: 10),
                                    Expanded(child: Text('Buscar en esta zona…', style: TextStyle(color: Colores.suave, fontSize: 15.5))),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Material(
                          color: Colors.white,
                          elevation: 3,
                          shadowColor: const Color(0x332B2118),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _abrirFiltros(u),
                            child: const SizedBox(width: 50, height: 50, child: Icon(Icons.tune, color: Colores.tinta)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  _Chips(
                    categoriaIds: _categoriaIds,
                    abierto: _abierto,
                    alCategoria: (ids) => setState(() {
                      _categoriaIds = ids;
                      _seleccionId = null;
                    }),
                    alAbierto: () => setState(() {
                      _abierto = !_abierto;
                      _seleccionId = null;
                    }),
                  ),
                  if (cargando) const Padding(padding: EdgeInsets.only(top: 8), child: _Cargando()),
                  if (_movido)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Colores.grana,
                          elevation: 3,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                        ),
                        onPressed: _buscarEnZona,
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Buscar en esta zona', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Atribución obligatoria de OpenStreetMap.
          Positioned(
            left: 10,
            bottom: baseInferior + 4,
            child: GestureDetector(
              onTap: () => launchUrl(Uri.parse('https://www.openstreetmap.org/copyright'), mode: LaunchMode.externalApplication),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(6)),
                child: const Text('© OpenStreetMap', style: TextStyle(fontSize: 10.5, color: Colores.suave)),
              ),
            ),
          ),

          // Botón de centrar.
          Positioned(
            right: 14,
            bottom: baseInferior + 28 + (seleccion != null ? 148 : 0),
            child: Material(
              color: Colors.white,
              elevation: 4,
              shadowColor: const Color(0x332B2118),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _centrar(u),
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: Icon(u.tienePunto ? Icons.my_location : Icons.location_searching, color: Colores.agave),
                ),
              ),
            ),
          ),

          // Tarjeta del negocio tocado en el mapa.
          if (seleccion != null)
            Positioned(
              left: 14,
              right: 14,
              bottom: baseInferior + 22,
              child: _TarjetaSeleccion(negocio: seleccion, distancia: _distanciaA(seleccion, u.punto)),
            ),

          // Lista que se arrastra.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            bottom: navH,
            child: LayoutBuilder(
              builder: (context, caja) {
                final minimo = (_alturaHoja / caja.maxHeight).clamp(0.08, 0.3);
                return DraggableScrollableSheet(
                  controller: _hoja,
                  initialChildSize: minimo,
                  minChildSize: minimo,
                  maxChildSize: 0.88,
                  snap: true,
                  snapSizes: [minimo, 0.5, 0.88],
                  builder: (context, scroll) => _Hoja(
                    scroll: scroll,
                    lista: lista,
                    radioKm: radio,
                    desdeMi: u.punto != null && _centroConsulta == u.punto,
                    cargando: cargando && _ultimos.isEmpty,
                    error: datos.hasError && _ultimos.isEmpty,
                    distanciaDe: (n) => _distanciaA(n, u.punto),
                    alReintentar: () => ref.invalidate(negociosCercaProvider(consulta)),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Marker _marcador(NegocioTarjeta n, bool grande) {
    final tam = grande ? 56.0 : 44.0;
    return Marker(
      point: LatLng(n.latitud!, n.longitud!),
      width: tam,
      height: tam * 2,
      // La punta del pin queda justo en la coordenada: el pin ocupa la mitad de arriba.
      child: Align(
        alignment: Alignment.topCenter,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _seleccionId = n.id),
          child: _Pin(color: tonoDe(n.categoriaClave ?? n.nombre), icono: iconoCategoria(n.categoriaClave), tam: tam, seleccionado: grande),
        ),
      ),
    );
  }

  /// Metros desde la persona (si sabemos dónde está) hasta el negocio.
  int? _distanciaA(NegocioTarjeta n, LatLng? yo) {
    if (yo == null || !n.tieneCoordenadas) return null;
    return const Distance().as(LengthUnit.Meter, yo, LatLng(n.latitud!, n.longitud!)).round();
  }

  List<NegocioTarjeta> _ordenar(List<NegocioTarjeta> base, LatLng? yo) {
    if (yo == null) return base;
    final copia = [...base];
    copia.sort((a, b) => (_distanciaA(a, yo) ?? 1 << 30).compareTo(_distanciaA(b, yo) ?? 1 << 30));
    return copia;
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.color, required this.icono, required this.tam, required this.seleccionado});

  final Color color;
  final IconData icono;
  final double tam;
  final bool seleccionado;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: tam,
      height: tam,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          Icon(Icons.location_on, size: tam, color: seleccionado ? Colores.tinta : color, shadows: const [Shadow(color: Color(0x55000000), blurRadius: 6, offset: Offset(0, 2))]),
          Positioned(
            top: tam * 0.17,
            child: Container(
              width: tam * 0.42,
              height: tam * 0.42,
              decoration: BoxDecoration(color: seleccionado ? color : Colors.white, shape: BoxShape.circle),
              child: Icon(icono, size: tam * 0.27, color: seleccionado ? Colors.white : color),
            ),
          ),
        ],
      ),
    );
  }
}

class _PuntoYo extends StatelessWidget {
  const _PuntoYo();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFF2F6FED).withValues(alpha: 0.18), shape: BoxShape.circle)),
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: const Color(0xFF2F6FED),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: const [BoxShadow(color: Color(0x44000000), blurRadius: 4)],
          ),
        ),
      ],
    );
  }
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Color(0x222B2118), blurRadius: 6)]),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colores.grana)),
          SizedBox(width: 8),
          Text('Buscando…', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Chips sobre el mapa: Todo, las categorías con más negocios y "Abierto ahora".
class _Chips extends ConsumerWidget {
  const _Chips({required this.categoriaIds, required this.abierto, required this.alCategoria, required this.alAbierto});

  final List<String> categoriaIds;
  final bool abierto;
  final ValueChanged<List<String>> alCategoria;
  final VoidCallback alAbierto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = [...(ref.watch(categoriasProvider).valueOrNull ?? const <CategoriaChip>[])]..sort((a, b) => b.total.compareTo(a.total));
    final visibles = cats.take(4).toList();
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        children: [
          _Chip(texto: 'Todo', activo: categoriaIds.isEmpty, alTocar: () => alCategoria(const [])),
          for (final c in visibles)
            _Chip(
              texto: c.nombre,
              icono: iconoCategoria(c.clave),
              activo: categoriaIds.length == c.ids.length && c.ids.every(categoriaIds.contains),
              alTocar: () => alCategoria(c.ids),
            ),
          _Chip(texto: 'Abierto ahora', activo: abierto, alTocar: alAbierto, colorActivo: Colores.ok),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.texto, required this.activo, required this.alTocar, this.icono, this.colorActivo = Colores.grana});

  final String texto;
  final bool activo;
  final VoidCallback alTocar;
  final IconData? icono;
  final Color colorActivo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: activo ? colorActivo : Colors.white,
        elevation: 2,
        shadowColor: const Color(0x332B2118),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: alTocar,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icono != null) ...[Icon(icono, size: 16, color: activo ? Colors.white : Colores.tinta), const SizedBox(width: 6)],
                Text(texto, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: activo ? Colors.white : Colores.tinta)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TarjetaSeleccion extends StatelessWidget {
  const _TarjetaSeleccion({required this.negocio, required this.distancia});

  final NegocioTarjeta negocio;
  final int? distancia;

  @override
  Widget build(BuildContext context) {
    final n = negocio;
    final extra = <String>[
      if (n.precioTexto != null) n.precioTexto!,
      if (distancia != null) textoDistancia(distancia!),
    ].join(' · ');
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: const Color(0x442B2118),
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push('/negocio/${n.slug}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FotoNegocio(url: n.portadaUrl, nombre: n.nombre, radio: 16, alto: 84, ancho: 84, icono: iconoCategoria(n.categoriaClave)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(child: Text(n.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(16.5))),
                            if (n.verificado) ...[const SizedBox(width: 5), const Icon(Icons.verified, size: 15, color: Colores.agave)],
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(n.ubicacion, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 10,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            EstrellaCalif(calificacion: n.calificacion, total: n.totalResenas),
                            EtiquetaAbierto(n.abiertoAhora),
                          ],
                        ),
                        if (extra.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(extra, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                        ],
                      ],
                    ),
                  ),
                  BotonCorazon(tipo: 'negocio', id: n.id, nombre: n.nombre, slug: n.slug, imagenUrl: n.portadaUrl, tam: 34, sombra: false),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22))),
                        onPressed: () => context.push('/negocio/${n.slug}'),
                        child: const Text('Ver ficha', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ),
                  if (n.tieneCoordenadas) ...[
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero, shape: const CircleBorder(), side: const BorderSide(color: Colores.linea)),
                        onPressed: () => Enlaces.comoLlegar(context, n.latitud!, n.longitud!),
                        child: const Icon(Icons.directions, color: Colores.agave),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Hoja extends StatelessWidget {
  const _Hoja({
    required this.scroll,
    required this.lista,
    required this.radioKm,
    required this.desdeMi,
    required this.cargando,
    required this.error,
    required this.distanciaDe,
    required this.alReintentar,
  });

  final ScrollController scroll;
  final List<NegocioTarjeta> lista;
  final double radioKm;
  final bool desdeMi;
  final bool cargando;
  final bool error;
  final int? Function(NegocioTarjeta) distanciaDe;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final km = radioKm == radioKm.roundToDouble() ? radioKm.toInt().toString() : radioKm.toStringAsFixed(1);
    final resumen = cargando
        ? 'Buscando negocios…'
        : '${lista.length} ${lista.length == 1 ? 'negocio' : 'negocios'} en $km km${desdeMi ? ' · del más cercano' : ''}';
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Color(0x332B2118), blurRadius: 18, offset: Offset(0, -4))],
      ),
      child: CustomScrollView(
        controller: scroll,
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
                  const SizedBox(height: 12),
                  Text(desdeMi ? 'Cerca de ti' : 'En esta zona', style: titulo(19)),
                  const SizedBox(height: 2),
                  Text(resumen, style: const TextStyle(color: Colores.suave, fontSize: 13)),
                ],
              ),
            ),
          ),
          if (error)
            SliverFillRemaining(
              hasScrollBody: false,
              child: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: 'Revisa tu conexión e inténtalo otra vez.', accion: alReintentar),
            )
          else if (!cargando && lista.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: EstadoVacio(
                icono: Icons.travel_explore,
                titulo: 'Nada por aquí todavía',
                texto: 'Prueba con más distancia en Filtros o quita alguna categoría.',
              ),
            )
          else
            SliverList.separated(
              itemCount: lista.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 20, endIndent: 20, color: Colores.linea),
              itemBuilder: (context, i) => _Fila(negocio: lista[i], metros: distanciaDe(lista[i])),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.negocio, required this.metros});

  final NegocioTarjeta negocio;
  final int? metros;

  @override
  Widget build(BuildContext context) {
    final n = negocio;
    final aPie = textoAPie(metros);
    return InkWell(
      onTap: () => context.push('/negocio/${n.slug}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            FotoNegocio(url: n.portadaUrl, nombre: n.nombre, radio: 14, alto: 58, ancho: 58, icono: iconoCategoria(n.categoriaClave)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(n.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(15.5)),
                  const SizedBox(height: 2),
                  Text(n.ubicacion, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      EstrellaCalif(calificacion: n.calificacion, total: n.totalResenas),
                      EtiquetaAbierto(n.abiertoAhora),
                    ],
                  ),
                ],
              ),
            ),
            if (metros != null) ...[
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(textoDistancia(metros!), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  if (aPie != null) Text(aPie, style: const TextStyle(fontSize: 11.5, color: Colores.suave)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
