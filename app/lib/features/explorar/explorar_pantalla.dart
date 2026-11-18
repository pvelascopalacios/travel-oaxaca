import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/config.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import 'modelos.dart';
import '../rutas/repositorio.dart';
import '../rutas/widgets.dart';
import 'repositorio.dart';
import 'widgets.dart';

/// Los negocios de una categoría principal (clave = sus ids unidos por coma).
final seccionProvider = FutureProvider.family<List<NegocioTarjeta>, String>((ref, ids) async {
  final p = await ref.watch(repositorioExplorarProvider).negocios(
        FiltrosNegocios(categoriaIds: ids.split(','), orden: 'calificacion'),
        tamano: 8,
      );
  return p.elementos;
});

class ExplorarPantalla extends ConsumerWidget {
  const ExplorarPantalla({super.key});

  static const double _altoHero = 300;
  static const double _altoBarra = 60;

  Future<void> _refrescar(WidgetRef ref) async {
    final cats = ref.read(categoriasProvider).valueOrNull ?? const <CategoriaChip>[];
    for (final c in cats) {
      ref.invalidate(seccionProvider(c.ids.join(',')));
    }
    ref.invalidate(regionesProvider);
    ref.invalidate(categoriasProvider);
    ref.invalidate(destacadosProvider);
    ref.invalidate(eventosProximosProvider);
    await ref.read(categoriasProvider.future).catchError((_) => <CategoriaChip>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(sesionProvider).valueOrNull;
    final categorias = ref.watch(categoriasProvider);
    final regiones = ref.watch(regionesProvider);
    final arriba = MediaQuery.of(context).padding.top;
    final abajo = MediaQuery.of(context).padding.bottom;
    final chips = categorias.valueOrNull ?? const <CategoriaChip>[];
    final totalNegocios = (regiones.valueOrNull ?? const <RegionConteo>[]).fold<int>(0, (a, r) => a + r.totalNegocios);

    return Stack(
      children: [
        RefreshIndicator(
          color: Colores.grana,
          edgeOffset: arriba + _altoBarra,
          onRefresh: () => _refrescar(ref),
          child: CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: _altoHero,
                toolbarHeight: _altoBarra,
                backgroundColor: Colores.crema,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                automaticallyImplyLeading: false,
                flexibleSpace: LayoutBuilder(builder: (context, box) {
                  final min = _altoBarra + arriba;
                  final max = _altoHero + arriba;
                  final t = ((box.maxHeight - min) / (max - min)).clamp(0.0, 1.0);
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      Opacity(
                        opacity: t,
                        child: _Hero(
                          arriba: arriba,
                          saludo: usuario == null ? 'Hola 👋' : 'Hola, ${usuario.primerNombre} 👋',
                          subtitulo: totalNegocios > 0 ? 'Costa, Sierra, Valles y más · $totalNegocios negocios' : 'Costa, Sierra, Valles y más',
                          inicial: usuario?.inicial,
                          fotoUrl: _primeraFoto(regiones.valueOrNull),
                          alBuscar: () => context.push('/buscar'),
                          alPerfil: () => context.go('/perfil'),
                        ),
                      ),
                      Positioned(
                        left: 18,
                        right: 14,
                        top: arriba,
                        height: _altoBarra,
                        child: IgnorePointer(
                          ignoring: t > 0.3,
                          child: Opacity(
                            opacity: (1 - t * 2).clamp(0.0, 1.0),
                            child: Row(
                              children: [
                                Expanded(child: Text('Oaxaca', style: titulo(22))),
                                _BotonRedondo(icono: Icons.search, alTocar: () => context.push('/buscar')),
                                const SizedBox(width: 8),
                                _Avatar(inicial: usuario?.inicial, alTocar: () => context.go('/perfil')),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _EncabezadoChips(
                  Container(
                    color: Colores.crema,
                    alignment: Alignment.centerLeft,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      children: [
                        _ChipCat(texto: '✨ Todo', activo: true, alTocar: () => context.push('/buscar')),
                        for (final c in chips.take(8))
                          _ChipCat(
                            texto: '${_emoji(c.clave)} ${c.nombre}',
                            alTocar: () => context.push('/buscar', extra: FiltrosNegocios(categoriaIds: c.ids)),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (chips.isEmpty)
                const SliverToBoxAdapter(child: _SeccionDestacados())
              else
                SliverList(
                  delegate: SliverChildListDelegate([
                    for (final c in chips.take(4)) _SeccionCategoria(chip: c),
                  ]),
                ),
              const SliverToBoxAdapter(child: _SeccionEventos()),
              const SliverToBoxAdapter(child: _SeccionRutas()),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
                  child: _EncabezadoSeccion(titulo: 'Regiones', texto: 'Cada una con su sabor.'),
                ),
              ),
              regiones.when(
                data: (lista) => lista.isEmpty
                    ? const SliverToBoxAdapter(child: SizedBox.shrink())
                    : SliverPadding(
                        padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                        sliver: SliverGrid(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 1.35,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => _TarjetaRegion(
                              region: lista[i],
                              alTocar: () => context.push('/buscar', extra: FiltrosNegocios(regionId: lista[i].id)),
                            ),
                            childCount: lista.length,
                          ),
                        ),
                      ),
                loading: () => const SliverToBoxAdapter(
                  child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
                ),
                error: (e, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                    child: _ErrorSeccion(error: e, reintentar: () => ref.invalidate(regionesProvider)),
                  ),
                ),
              ),
              SliverToBoxAdapter(child: SizedBox(height: abajo + 80)),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: abajo + 8,
          child: Center(
            child: Material(
              color: Colores.tinta,
              borderRadius: BorderRadius.circular(30),
              elevation: 6,
              shadowColor: Colors.black38,
              child: InkWell(
                borderRadius: BorderRadius.circular(30),
                onTap: () => context.go('/cerca'),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.place_outlined, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Mapa', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14.5)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static String? _primeraFoto(List<RegionConteo>? l) {
    if (l == null) return null;
    for (final r in l) {
      if (r.portadaUrl != null && r.portadaUrl!.isNotEmpty) return r.portadaUrl;
    }
    return null;
  }

  static String _emoji(String clave) {
    final c = clave.toLowerCase();
    if (c.contains('com') || c.contains('rest') || c.contains('gastro') || c.contains('food')) return '🍽️';
    if (c.contains('dorm') || c.contains('hosped') || c.contains('hotel') || c.contains('aloj')) return '🛏️';
    if (c.contains('tour') || c.contains('experien') || c.contains('guia') || c.contains('excurs')) return '🧭';
    if (c.contains('artes') || c.contains('compr') || c.contains('tienda')) return '🛍️';
    if (c.contains('mezcal') || c.contains('bar')) return '🥃';
    return '📍';
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.arriba,
    required this.saludo,
    required this.subtitulo,
    required this.inicial,
    required this.fotoUrl,
    required this.alBuscar,
    required this.alPerfil,
  });

  final double arriba;
  final String saludo;
  final String subtitulo;
  final String? inicial;
  final String? fotoUrl;
  final VoidCallback alBuscar;
  final VoidCallback alPerfil;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF2C46B), Color(0xFFD07A2A), Color(0xFFA5174F), Color(0xFF5E0F33)],
              stops: [0, 0.38, 0.78, 1],
            ),
          ),
        ),
        if (urlImagen(fotoUrl) != null)
          Opacity(
            opacity: 0.45,
            child: Image.network(urlImagen(fotoUrl)!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x33000000), Colors.transparent, Color(0x99300A1C)],
              stops: [0, 0.35, 1],
            ),
          ),
        ),
        Positioned(
          left: 18,
          right: 14,
          top: arriba + 10,
          child: Row(
            children: [
              Expanded(child: Text('Travel Oaxaca', style: titulo(17, color: Colors.white))),
              _Avatar(inicial: inicial, alTocar: alPerfil, vidrio: true),
            ],
          ),
        ),
        Positioned(
          left: 18,
          right: 18,
          bottom: 82,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(saludo, style: const TextStyle(color: Colors.white, fontSize: 13)),
              const SizedBox(height: 2),
              Text('Oaxaca', style: titulo(44, color: Colors.white)),
              const SizedBox(height: 4),
              Text(subtitulo, style: const TextStyle(color: Colors.white, fontSize: 13.5)),
            ],
          ),
        ),
        Positioned(
          left: 18,
          right: 18,
          bottom: 18,
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(30),
            elevation: 6,
            shadowColor: Colors.black38,
            child: InkWell(
              borderRadius: BorderRadius.circular(30),
              onTap: alBuscar,
              child: Container(
                height: 54,
                padding: const EdgeInsets.fromLTRB(18, 0, 8, 0),
                child: const Row(
                  children: [
                    Icon(Icons.search, color: Colores.suave),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text('Busca hoteles, mezcal, pueblos…',
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colores.suave)),
                    ),
                    CircleAvatar(
                      radius: 19,
                      backgroundColor: Colores.grana,
                      child: Icon(Icons.tune, color: Colors.white, size: 18),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.inicial, required this.alTocar, this.vidrio = false});
  final String? inicial;
  final VoidCallback alTocar;
  final bool vidrio;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: alTocar,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: vidrio ? Colors.white.withValues(alpha: 0.25) : Colores.grana,
          border: vidrio ? Border.all(color: Colors.white54) : null,
        ),
        child: inicial == null
            ? const Icon(Icons.person_outline, color: Colors.white, size: 21)
            : Text(inicial!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _BotonRedondo extends StatelessWidget {
  const _BotonRedondo({required this.icono, required this.alTocar});
  final IconData icono;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: alTocar,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, border: Border.all(color: Colores.linea, width: 1.5)),
        child: Icon(icono, size: 20, color: Colores.tinta),
      ),
    );
  }
}

class _EncabezadoChips extends SliverPersistentHeaderDelegate {
  _EncabezadoChips(this.hijo);
  final Widget hijo;

  @override
  double get minExtent => 58;
  @override
  double get maxExtent => 58;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => hijo;

  @override
  bool shouldRebuild(covariant _EncabezadoChips old) => true;
}

class _EncabezadoSeccion extends StatelessWidget {
  const _EncabezadoSeccion({required this.titulo, required this.texto, this.alVerTodo});
  final String titulo;
  final String texto;
  final VoidCallback? alVerTodo;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: _tituloSeccion),
              const SizedBox(height: 4),
              Text(texto, style: const TextStyle(fontSize: 13.5, color: Colores.suave, height: 1.3)),
            ],
          ),
        ),
        if (alVerTodo != null)
          TextButton(
            onPressed: alVerTodo,
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 6), minimumSize: const Size(0, 36)),
            child: const Text('Ver todo', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }
}

TextStyle get _tituloSeccion => titulo(22);

class _SeccionCategoria extends ConsumerWidget {
  const _SeccionCategoria({required this.chip});
  final CategoriaChip chip;

  (String, String) get _textos {
    final c = chip.clave.toLowerCase();
    if (c.contains('dorm') || c.contains('hosped') || c.contains('hotel') || c.contains('aloj')) {
      return ('Dónde dormir', 'Casas, hoteles y posadas con encanto.');
    }
    if (c.contains('com') || c.contains('rest') || c.contains('gastro') || c.contains('food')) {
      return ('Qué comer', 'Fondas, mezcalerías y cocina de temporada.');
    }
    if (c.contains('tour') || c.contains('experien') || c.contains('guia') || c.contains('excurs')) {
      return ('Qué hacer', 'Tours y experiencias con guías locales.');
    }
    if (c.contains('artes')) return ('Artesanías', 'Piezas hechas a mano por artesanos de Oaxaca.');
    return (chip.nombre, 'Lo mejor en ${chip.nombre.toLowerCase()}.');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(seccionProvider(chip.ids.join(',')));
    final (titulo, texto) = _textos;
    return datos.when(
      data: (lista) {
        if (lista.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 26),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _EncabezadoSeccion(
                  titulo: titulo,
                  texto: texto,
                  alVerTodo: () => context.push('/buscar', extra: FiltrosNegocios(categoriaIds: chip.ids)),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 320,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  itemCount: lista.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (_, i) =>
                      TarjetaNegocioAlta(negocio: lista[i], alTocar: () => context.push('/negocio/${lista[i].slug}')),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const SizedBox(height: 120, child: Center(child: CircularProgressIndicator(strokeWidth: 2.5))),
      error: (e, _) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
        child: _ErrorSeccion(error: e, reintentar: () => ref.invalidate(seccionProvider(chip.ids.join(',')))),
      ),
    );
  }
}

class _SeccionEventos extends ConsumerWidget {
  const _SeccionEventos();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(eventosProximosProvider);
    return d.maybeWhen(
      data: (lista) {
        if (lista.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 26),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _EncabezadoSeccion(
                  titulo: 'Eventos próximos',
                  texto: 'Fiestas, ferias y tradiciones que se acercan.',
                  alVerTodo: () => context.push('/buscar?tab=eventos'),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 168,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  itemCount: lista.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (_, i) =>
                      TarjetaEventoCarrusel(evento: lista[i], alTocar: () => context.push('/evento/${lista[i].slug}')),
                ),
              ),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

/// Respaldo cuando la API aún no devuelve categorías: los mejor calificados.
class _SeccionDestacados extends ConsumerWidget {
  const _SeccionDestacados();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(destacadosProvider);
    return d.when(
      data: (lista) => lista.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: EstadoVacio(
                icono: Icons.storefront_outlined,
                titulo: 'Aún no hay negocios publicados',
                texto: 'Cuando se publiquen, los verás aquí.',
              ),
            )
          : Padding(
              padding: const EdgeInsets.only(top: 26),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 18),
                    child: _EncabezadoSeccion(titulo: 'Los mejor calificados', texto: 'Lo que más recomiendan.'),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 320,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      itemCount: lista.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (_, i) =>
                          TarjetaNegocioAlta(negocio: lista[i], alTocar: () => context.push('/negocio/${lista[i].slug}')),
                    ),
                  ),
                ],
              ),
            ),
      loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
      error: (e, _) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
        child: _ErrorSeccion(error: e, reintentar: () => ref.invalidate(destacadosProvider)),
      ),
    );
  }
}

class _ChipCat extends StatelessWidget {
  const _ChipCat({required this.texto, required this.alTocar, this.activo = false});
  final String texto;
  final bool activo;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: activo ? Colores.tinta : Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: alTocar,
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 15),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: activo ? Colores.tinta : Colores.linea, width: 1.5),
            ),
            child: Text(texto,
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: activo ? Colors.white : Colores.tinta)),
          ),
        ),
      ),
    );
  }
}

class _TarjetaRegion extends StatelessWidget {
  const _TarjetaRegion({required this.region, required this.alTocar});
  final RegionConteo region;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final tono = tonoDe(region.nombre);
    return Material(
      color: tono,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: alTocar,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (region.portadaUrl != null) FotoNegocio(url: region.portadaUrl, nombre: region.nombre, radio: 0),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black.withValues(alpha: 0.5)],
                  stops: const [0.4, 1],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(region.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(17, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text('${region.totalNegocios} negocios', style: const TextStyle(color: Colors.white, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorSeccion extends StatelessWidget {
  const _ErrorSeccion({required this.error, required this.reintentar});
  final Object error;
  final VoidCallback reintentar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colores.avisoFondo,
        borderRadius: BorderRadius.circular(14),
        border: const Border(left: BorderSide(color: Colores.grana, width: 4)),
      ),
      child: Row(
        children: [
          Expanded(child: Text(ErrorApi.desde(error).general, style: const TextStyle(fontSize: 13.5, height: 1.35))),
          TextButton(onPressed: reintentar, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}

class _SeccionRutas extends ConsumerWidget {
  const _SeccionRutas();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(rutasDestacadasProvider);
    return d.maybeWhen(
      data: (lista) {
        if (lista.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 26),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _EncabezadoSeccion(
                  titulo: 'Rutas',
                  texto: 'Recorridos armados, listos para seguir.',
                  alVerTodo: () => context.push('/rutas'),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 320,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  itemCount: lista.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (_, i) => SizedBox(
                    width: 280,
                    child: TarjetaRuta(ruta: lista[i], alTocar: () => context.push('/ruta/${lista[i].slug}')),
                  ),
                ),
              ),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
