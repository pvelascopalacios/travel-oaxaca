import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/tema.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'widgets.dart';

/// Resultados de búsqueda en un solo listado (negocios, lugares y eventos).
/// "Ver todos" de una sección abre su lista completa con paginación.
class BuscarPantalla extends ConsumerStatefulWidget {
  const BuscarPantalla({super.key, this.inicial = const FiltrosNegocios(), this.vistaInicial = -1});

  final FiltrosNegocios inicial;

  /// -1 listado general, 0 negocios, 1 lugares, 2 eventos.
  final int vistaInicial;

  @override
  ConsumerState<BuscarPantalla> createState() => _BuscarPantallaState();
}

class _BuscarPantallaState extends ConsumerState<BuscarPantalla> {
  final _texto = TextEditingController();
  final _scroll = ScrollController();
  Timer? _espera;

  late FiltrosNegocios _f;
  late int _vista;

  final List<NegocioTarjeta> _negocios = [];
  final List<LugarTarjeta> _lugares = [];
  final List<EventoTarjeta> _eventos = [];
  int _totalNegocios = 0;
  int _totalLugares = 0;
  int _totalEventos = 0;
  int _paginaN = 0;
  int _paginaL = 0;
  int _paginaE = 0;
  bool _hayMasN = false;
  bool _hayMasL = false;
  bool _hayMasE = false;
  bool _cargando = false;
  bool _cargandoMas = false;
  ErrorApi? _error;
  int _consulta = 0; // evita que una respuesta vieja pise a una nueva

  bool get _directo => widget.vistaInicial != -1;

  @override
  void initState() {
    super.initState();
    _f = widget.inicial;
    _vista = widget.vistaInicial;
    _texto.text = _f.q;
    _scroll.addListener(() {
      if (_vista != -1 && _scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _masResultados();
    });
    _buscar();
  }

  @override
  void dispose() {
    _espera?.cancel();
    _texto.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _buscar() async {
    final mia = ++_consulta;
    setState(() {
      _cargando = true;
      _error = null;
    });
    final repo = ref.read(repositorioExplorarProvider);
    try {
      final r = await Future.wait([repo.negocios(_f), repo.lugares(_f.q), repo.eventos(_f.q)]);
      if (!mounted || mia != _consulta) return;
      final n = r[0] as Pagina<NegocioTarjeta>;
      final l = r[1] as Pagina<LugarTarjeta>;
      final ev = r[2] as Pagina<EventoTarjeta>;
      setState(() {
        _negocios
          ..clear()
          ..addAll(n.elementos);
        _lugares
          ..clear()
          ..addAll(l.elementos);
        _eventos
          ..clear()
          ..addAll(ev.elementos);
        _totalNegocios = n.total;
        _totalLugares = l.total;
        _totalEventos = ev.total;
        _paginaN = _paginaL = _paginaE = 0;
        _hayMasN = n.hayMas;
        _hayMasL = l.hayMas;
        _hayMasE = ev.hayMas;
      });
    } catch (e) {
      if (!mounted || mia != _consulta) return;
      setState(() => _error = ErrorApi.desde(e));
    } finally {
      if (mounted && mia == _consulta) setState(() => _cargando = false);
    }
  }

  Future<void> _masResultados() async {
    if (_cargando || _cargandoMas) return;
    if (_vista == 0 ? !_hayMasN : (_vista == 1 ? !_hayMasL : !_hayMasE)) return;
    final mia = _consulta;
    setState(() => _cargandoMas = true);
    final repo = ref.read(repositorioExplorarProvider);
    try {
      if (_vista == 0) {
        final p = await repo.negocios(_f, pagina: _paginaN + 1);
        if (!mounted || mia != _consulta) return;
        setState(() {
          _negocios.addAll(p.elementos);
          _paginaN = p.pagina;
          _hayMasN = p.hayMas;
        });
      } else if (_vista == 2) {
        final p = await repo.eventos(_f.q, pagina: _paginaE + 1);
        if (!mounted || mia != _consulta) return;
        setState(() {
          _eventos.addAll(p.elementos);
          _paginaE = p.pagina;
          _hayMasE = p.hayMas;
        });
      } else {
        final p = await repo.lugares(_f.q, pagina: _paginaL + 1);
        if (!mounted || mia != _consulta) return;
        setState(() {
          _lugares.addAll(p.elementos);
          _paginaL = p.pagina;
          _hayMasL = p.hayMas;
        });
      }
    } catch (_) {
      // Si falla la siguiente página, se queda lo que ya hay; al seguir bajando se reintenta.
    } finally {
      if (mounted) setState(() => _cargandoMas = false);
    }
  }

  void _alEscribir(String v) {
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 450), () {
      _f = _f.copiar(q: v);
      _buscar();
    });
  }

  void _cambiar(FiltrosNegocios nuevo) {
    _f = nuevo;
    _buscar();
  }

  void _atras() {
    if (_vista != -1 && !_directo) {
      setState(() => _vista = -1);
    } else {
      context.pop();
    }
  }

  Future<void> _elegirPrecio() async {
    final v = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Precio máximo', style: titulo(20)),
              const SizedBox(height: 10),
              for (final op in const [(1, '\$  Económico'), (2, '\$\$  Moderado'), (3, '\$\$\$  Alto')])
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(op.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                  trailing: _f.precioMax == op.$1 ? const Icon(Icons.check, color: Colores.grana) : null,
                  onTap: () => Navigator.pop(c, op.$1),
                ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Cualquier precio'),
                onTap: () => Navigator.pop(c, 0),
              ),
            ],
          ),
        ),
      ),
    );
    if (v == null) return;
    _cambiar(_f.copiar(precioMax: v == 0 ? null : v));
  }

  @override
  Widget build(BuildContext context) {
    final regiones = ref.watch(regionesProvider).valueOrNull ?? const <RegionConteo>[];
    String? nombreRegion;
    for (final r in regiones) {
      if (r.id == _f.regionId) nombreRegion = r.nombre;
    }
    final conFiltros = _vista == -1 || _vista == 0;

    return PopScope(
      canPop: _vista == -1 || _directo,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _vista = -1);
      },
      child: Scaffold(
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => context.go('/cerca'),
          backgroundColor: Colores.tinta,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.place_outlined),
          label: const Text('Ver en mapa', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
        body: Stack(
          children: [
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                    child: Row(
                      children: [
                        IconButton(onPressed: _atras, icon: const Icon(Icons.arrow_back)),
                        Expanded(
                          child: Container(
                            height: 48,
                            padding: const EdgeInsets.only(left: 16, right: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(30),
                              boxShadow: const [BoxShadow(color: Color(0x1A2B2118), blurRadius: 14, offset: Offset(0, 4))],
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.search, size: 20, color: Colores.suave),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _texto,
                                    autofocus: widget.inicial.q.isEmpty && !widget.inicial.hayFiltros && !_directo,
                                    textInputAction: TextInputAction.search,
                                    onChanged: (v) {
                                      setState(() {});
                                      _alEscribir(v);
                                    },
                                    onSubmitted: (v) {
                                      _espera?.cancel();
                                      _cambiar(_f.copiar(q: v));
                                    },
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                    decoration: const InputDecoration(
                                      hintText: 'Busca hoteles, mezcal, pueblos…',
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      filled: false,
                                      isDense: true,
                                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                                    ),
                                  ),
                                ),
                                if (_texto.text.isNotEmpty)
                                  IconButton(
                                    icon: const Icon(Icons.close, size: 19),
                                    onPressed: () {
                                      _texto.clear();
                                      _cambiar(_f.copiar(q: ''));
                                    },
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (conFiltros) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 38,
                      child: ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        scrollDirection: Axis.horizontal,
                        children: [
                          _Chip(
                            texto: '🕒 Abierto ahora',
                            activo: _f.abiertoAhora,
                            alTocar: () => _cambiar(_f.copiar(abiertoAhora: !_f.abiertoAhora)),
                          ),
                          _Chip(
                            texto: _f.precioMax == null ? '\$ Precio ▾' : '${'\$' * _f.precioMax!} ▾',
                            activo: _f.precioMax != null,
                            alTocar: _elegirPrecio,
                          ),
                          _Chip(
                            texto: '★ Mejor calificados',
                            activo: _f.orden == 'calificacion',
                            alTocar: () => _cambiar(_f.copiar(orden: _f.orden == 'calificacion' ? 'relevancia' : 'calificacion')),
                          ),
                          if (_f.regionId != null)
                            _Chip(texto: '📍 ${nombreRegion ?? 'Región'} ✕', activo: true, alTocar: () => _cambiar(_f.copiar(regionId: null))),
                          if (_f.categoriaIds.isNotEmpty)
                            _Chip(texto: 'Categoría ✕', activo: true, alTocar: () => _cambiar(_f.copiar(categoriaIds: const []))),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Expanded(child: _cuerpo()),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 130,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colores.crema.withValues(alpha: 0), Colores.crema],
                      stops: const [0, 0.6],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _cuerpo() {
    final sinNada = _negocios.isEmpty && _lugares.isEmpty && _eventos.isEmpty;
    if (_cargando && sinNada) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return EstadoVacio(icono: Icons.cloud_off_outlined, titulo: 'No pudimos cargar', texto: _error!.general, accion: _buscar);
    }
    if (_vista == -1) {
      if (sinNada) {
        return EstadoVacio(
          icono: Icons.search_off,
          titulo: 'No encontramos nada',
          texto: 'Prueba con otra palabra o quita algún filtro.',
          accion: _f.hayFiltros ? () => _cambiar(const FiltrosNegocios().copiar(q: _f.q)) : null,
          textoAccion: 'Quitar filtros',
        );
      }
      return _feed();
    }
    return _listaCompleta();
  }

  Widget _encabezado(String titulo_, int total, {int? vista}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: titulo_, style: titulo(20)),
                  TextSpan(text: '  $total', style: const TextStyle(fontSize: 14, color: Colores.suave, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
          if (vista != null)
            TextButton(
              onPressed: () => setState(() {
                _vista = vista;
                if (_scroll.hasClients) _scroll.jumpTo(0);
              }),
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 6), minimumSize: const Size(0, 34)),
              child: const Text('Ver todos', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }

  Widget _feed() {
    final negociosMostrados = _negocios.take(4).toList();
    return RefreshIndicator(
      color: Colores.grana,
      onRefresh: _buscar,
      child: ListView(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
        children: [
          if (_negocios.isNotEmpty) ...[
            _encabezado('Negocios', _totalNegocios, vista: _totalNegocios > negociosMostrados.length ? 0 : null),
            for (final n in negociosMostrados)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: TarjetaNegocioAncha(negocio: n, alTocar: () => context.push('/negocio/${n.slug}')),
              ),
          ],
          if (_lugares.isNotEmpty) ...[
            const SizedBox(height: 6),
            _encabezado('Lugares', _totalLugares, vista: 1),
            SizedBox(
              height: 150,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _lugares.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (_, i) => TarjetaLugarMini(lugar: _lugares[i], alTocar: () => context.push('/lugar/${_lugares[i].slug}')),
              ),
            ),
          ],
          if (_eventos.isNotEmpty) ...[
            const SizedBox(height: 22),
            _encabezado('Eventos', _totalEventos, vista: _totalEventos > 3 ? 2 : null),
            for (final e in _eventos.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TarjetaEventoFila(evento: e, alTocar: () => context.push('/evento/${e.slug}')),
              ),
          ],
        ],
      ),
    );
  }

  Widget _listaCompleta() {
    final total = _vista == 0 ? _totalNegocios : (_vista == 1 ? _totalLugares : _totalEventos);
    final cuenta = _vista == 0 ? _negocios.length : (_vista == 1 ? _lugares.length : _eventos.length);
    final titulo_ = _vista == 0 ? 'Negocios' : (_vista == 1 ? 'Lugares' : 'Eventos');
    if (cuenta == 0) {
      return EstadoVacio(
        icono: Icons.search_off,
        titulo: _vista == 0 ? 'No encontramos negocios' : (_vista == 1 ? 'No encontramos lugares' : 'No hay eventos próximos'),
        texto: 'Prueba con otra palabra o quita algún filtro.',
        accion: _f.hayFiltros ? () => _cambiar(const FiltrosNegocios().copiar(q: _f.q)) : null,
        textoAccion: 'Quitar filtros',
      );
    }
    return RefreshIndicator(
      color: Colores.grana,
      onRefresh: _buscar,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
        itemCount: cuenta + 1 + (_cargandoMas ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == 0) return _encabezado(titulo_, total);
          final k = i - 1;
          if (k >= cuenta) {
            return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)));
          }
          Widget tarjeta;
          if (_vista == 0) {
            final n = _negocios[k];
            tarjeta = TarjetaNegocioAncha(negocio: n, alTocar: () => context.push('/negocio/${n.slug}'));
          } else if (_vista == 1) {
            final l = _lugares[k];
            tarjeta = TarjetaLugarFila(lugar: l, alTocar: () => context.push('/lugar/${l.slug}'));
          } else {
            final e = _eventos[k];
            tarjeta = TarjetaEventoFila(evento: e, alTocar: () => context.push('/evento/${e.slug}'));
          }
          return Padding(padding: const EdgeInsets.only(bottom: 12), child: tarjeta);
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.texto, required this.alTocar, this.activo = false});
  final String texto;
  final bool activo;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: activo ? Colores.tinta : Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: alTocar,
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: activo ? Colores.tinta : Colores.linea, width: 1.5),
            ),
            child: Text(texto,
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: activo ? Colors.white : Colores.tinta)),
          ),
        ),
      ),
    );
  }
}
