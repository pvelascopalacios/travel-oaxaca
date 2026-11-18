import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart' show EstadoVacio;
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

/// Todas las rutas publicadas, con filtros de dificultad y transporte.
class RutasPantalla extends ConsumerStatefulWidget {
  const RutasPantalla({super.key});

  @override
  ConsumerState<RutasPantalla> createState() => _RutasPantallaState();
}

class _RutasPantallaState extends ConsumerState<RutasPantalla> {
  final _scroll = ScrollController();
  String? _dificultad;
  String? _transporte;
  final List<RutaTarjeta> _items = [];
  int _pagina = 0;
  int _total = 0;
  bool _cargando = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _cargar();
    });
    _cargar(reiniciar: true);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  bool get _hayMas => _items.length < _total;

  Future<void> _cargar({bool reiniciar = false}) async {
    if (_cargando || (!reiniciar && !_hayMas)) return;
    setState(() {
      _cargando = true;
      _error = null;
      if (reiniciar) {
        _items.clear();
        _pagina = 0;
        _total = 0;
      }
    });
    try {
      final p = await ref.read(repositorioRutasProvider).rutas(dificultad: _dificultad, transporte: _transporte, pagina: _pagina);
      if (!mounted) return;
      setState(() {
        _items.addAll(p.elementos);
        _total = p.total;
        _pagina++;
        _cargando = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _cargando = false;
        });
      }
    }
  }

  void _filtrar({String? dificultad, String? transporte, bool limpiarDif = false, bool limpiarTr = false}) {
    setState(() {
      if (limpiarDif) _dificultad = null;
      if (dificultad != null) _dificultad = dificultad;
      if (limpiarTr) _transporte = null;
      if (transporte != null) _transporte = transporte;
    });
    _cargar(reiniciar: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.canPop() ? context.pop() : context.go('/explorar')),
        title: Text('Rutas', style: titulo(18)),
      ),
      body: ListView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(0, 6, 0, 40),
        children: [
          _FilaChips(
            opciones: [for (final d in dificultades) (d.$1, d.$2)],
            elegido: _dificultad,
            textoTodas: 'Todas',
            alElegir: (v) => v == null ? _filtrar(limpiarDif: true) : _filtrar(dificultad: v),
          ),
          const SizedBox(height: 8),
          _FilaChips(
            opciones: [for (final t in transportes) (t.$1, t.$2)],
            elegido: _transporte,
            textoTodas: 'Cualquier transporte',
            alElegir: (v) => v == null ? _filtrar(limpiarTr: true) : _filtrar(transporte: v),
          ),
          const SizedBox(height: 12),
          if (_items.isEmpty && _cargando)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (_error != null && _items.isEmpty)
            SizedBox(height: 360, child: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: ErrorApi.desde(_error!).general, accion: () => _cargar(reiniciar: true)))
          else if (_items.isEmpty)
            const SizedBox(
              height: 360,
              child: EstadoVacio(icono: Icons.alt_route, titulo: 'No hay rutas con esos filtros', texto: 'Prueba con otra dificultad u otro transporte.'),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_total == 1 ? '1 ruta publicada' : '$_total rutas publicadas', style: const TextStyle(color: Colores.suave, fontSize: 13)),
                  const SizedBox(height: 10),
                  for (final r in _items) ...[
                    TarjetaRuta(ruta: r, alTocar: () => context.push('/ruta/${r.slug}')),
                    const SizedBox(height: 14),
                  ],
                  if (_cargando) const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2.5))),
                  if (_error != null) Center(child: TextButton(onPressed: _cargar, child: const Text('No pudimos cargar más. Reintentar'))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _FilaChips extends StatelessWidget {
  const _FilaChips({required this.opciones, required this.elegido, required this.textoTodas, required this.alElegir});

  final List<(String, String)> opciones;
  final String? elegido;
  final String textoTodas;
  final ValueChanged<String?> alElegir;

  @override
  Widget build(BuildContext context) {
    Widget chip(String texto, bool activo, VoidCallback alTocar) => Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Material(
            color: activo ? Colores.tinta : Colors.white,
            shape: StadiumBorder(side: BorderSide(color: activo ? Colores.tinta : Colores.linea, width: 1.5)),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: alTocar,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                child: Text(texto, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: activo ? Colors.white : Colores.tinta)),
              ),
            ),
          ),
        );
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        children: [
          chip(textoTodas, elegido == null, () => alElegir(null)),
          for (final o in opciones) chip(o.$2, elegido == o.$1, () => alElegir(o.$1)),
        ],
      ),
    );
  }
}
