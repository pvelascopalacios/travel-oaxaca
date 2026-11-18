import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/adaptativo.dart';
import '../../core/tema.dart';
import '../detalle/modelos.dart' show Favorito;
import '../detalle/repositorio.dart' show favoritosProvider;
import '../explorar/widgets.dart' show EstadoVacio, FotoNegocio;
import 'formulario_lista.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';

/// Una lista o un itinerario: sus elementos, con orden y (en itinerarios) días.
class ListaPantalla extends ConsumerStatefulWidget {
  const ListaPantalla({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ListaPantalla> createState() => _ListaPantallaState();
}

class _ListaPantallaState extends ConsumerState<ListaPantalla> {
  int _dia = 1;
  int _diasExtra = 1;
  bool _ocupado = false;

  void _aviso(String texto) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(texto)));
  }

  /// Corre una operación contra la API, refresca la lista y avisa si falló.
  Future<bool> _hacer(Future<void> Function() accion) async {
    setState(() => _ocupado = true);
    try {
      await accion();
      ref.invalidate(listaDetalleProvider(widget.id));
      ref.invalidate(misListasProvider);
      await ref.read(listaDetalleProvider(widget.id).future);
      return true;
    } catch (e) {
      _aviso(ErrorApi.desde(e).general);
      ref.invalidate(listaDetalleProvider(widget.id));
      return false;
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _reordenar(ListaDetalle l, List<ListaItem> visibles, int viejo, int nuevo) async {
    if (nuevo > viejo) nuevo -= 1;
    if (nuevo == viejo) return;
    final lista = [...visibles];
    final movido = lista.removeAt(viejo);
    lista.insert(nuevo, movido);
    final repo = ref.read(repositorioListasProvider);
    await _hacer(() async {
      final llamadas = <Future<void>>[];
      for (var i = 0; i < lista.length; i++) {
        final it = lista[i];
        if (it.orden == i && it.itemId != movido.itemId) continue;
        llamadas.add(repo.editarItem(l.id, it.itemId, dia: it.dia, orden: i, nota: it.nota));
      }
      await Future.wait(llamadas);
    });
  }

  Future<void> _editarNota(ListaDetalle l, ListaItem it) async {
    final c = TextEditingController(text: it.nota ?? '');
    final nota = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colores.crema,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Nota', style: titulo(20)),
            const SizedBox(height: 4),
            Text(it.nombre, style: const TextStyle(color: Colores.suave, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: c,
              autofocus: true,
              maxLength: 300,
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Ej. Llegar temprano, reservar mesa…'),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: () => Navigator.of(ctx).pop(c.text.trim()),
                style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25))),
                child: const Text('Guardar nota', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
    c.dispose();
    if (nota == null) return;
    await _hacer(() => ref.read(repositorioListasProvider).editarItem(l.id, it.itemId, dia: it.dia, orden: it.orden, nota: nota.isEmpty ? null : nota));
  }

  Future<void> _moverDeDia(ListaDetalle l, ListaItem it, int dias) async {
    final destino = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colores.crema,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mover a otro día', style: titulo(20)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var d = 1; d <= dias; d++)
                    if (d != (it.dia ?? 1)) ActionChip(label: Text('Día $d'), onPressed: () => Navigator.of(ctx).pop(d)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (destino == null) return;
    final alFinal = l.delDia(destino).length;
    final ok = await _hacer(() => ref.read(repositorioListasProvider).editarItem(l.id, it.itemId, dia: destino, orden: alFinal, nota: it.nota));
    if (ok && mounted) setState(() => _dia = destino);
  }

  Future<void> _quitar(ListaDetalle l, ListaItem it) async {
    await _hacer(() => ref.read(repositorioListasProvider).quitarItem(l.id, it.itemId));
    _aviso('Quitado de la lista.');
  }

  Future<void> _eliminar(ListaDetalle l) async {
    final si = await confirmar(
      context,
      titulo: l.esItinerario ? '¿Eliminar este itinerario?' : '¿Eliminar esta lista?',
      texto: 'Se borra con todo lo que tiene guardado. No se puede deshacer.',
      si: 'Eliminar',
      peligro: true,
    );
    if (!si) return;
    setState(() => _ocupado = true);
    try {
      await ref.read(repositorioListasProvider).borrar(l.id);
      ref.invalidate(misListasProvider);
      if (mounted) context.pop();
    } catch (e) {
      _aviso(ErrorApi.desde(e).general);
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _agregar(ListaDetalle l, int dia) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colores.crema,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
      builder: (_) => _AgregarDeFavoritos(listaId: l.id, esItinerario: l.esItinerario, dia: dia, titulo: l.esItinerario ? 'Agregar al día $dia' : 'Agregar a la lista'),
    );
    ref.invalidate(listaDetalleProvider(widget.id));
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(listaDetalleProvider(widget.id));
    return d.when(
      loading: () => Scaffold(
        backgroundColor: Colores.crema,
        appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.pop())),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: Colores.crema,
        appBar: AppBar(leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.pop())),
        body: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: ErrorApi.desde(e).general, accion: () => ref.invalidate(listaDetalleProvider(widget.id))),
      ),
      data: _contenido,
    );
  }

  Widget _contenido(ListaDetalle l) {
    final conFechas = l.fechaInicio != null && l.fechaFin != null;
    final dias = l.esItinerario ? (conFechas ? l.totalDias : (l.totalDias > _diasExtra ? l.totalDias : _diasExtra)) : 1;
    final dia = _dia > dias ? dias : _dia;
    final visibles = l.esItinerario ? l.delDia(dia) : (l.elementos.toList()..sort((a, b) => a.orden.compareTo(b.orden)));

    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.canPop() ? context.pop() : context.go('/listas')),
        title: Text(l.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(18)),
        centerTitle: true,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz),
            onSelected: (v) async {
              if (v == 'editar') {
                final r = await mostrarFormularioLista(context, existente: l.aResumen());
                if (r != null) ref.invalidate(listaDetalleProvider(widget.id));
              } else if (v == 'eliminar') {
                await _eliminar(l);
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'editar', child: Text('Editar')),
              PopupMenuItem(value: 'eliminar', child: Text('Eliminar', style: TextStyle(color: Colores.grana))),
            ],
          ),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 110),
            children: [
              Text(tipoLista(l.aResumen()), style: const TextStyle(color: Colores.suave, fontSize: 13)),
              const SizedBox(height: 12),
              if (l.esItinerario) ...[
                SizedBox(
                  height: 40,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (var i = 1; i <= dias; i++) _ChipDia(texto: 'Día $i', activo: i == dia, alTocar: () => setState(() => _dia = i)),
                      if (!conFechas && dias < 60)
                        _ChipDia(
                          texto: '＋ Día',
                          activo: false,
                          alTocar: () => setState(() {
                            _diasExtra = dias + 1;
                            _dia = dias + 1;
                          }),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],
              if (visibles.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  child: Column(
                    children: [
                      const Icon(Icons.add_location_alt_outlined, size: 44, color: Colores.suave),
                      const SizedBox(height: 10),
                      Text(l.esItinerario ? 'Este día está vacío' : 'Esta lista está vacía', style: titulo(18)),
                      const SizedBox(height: 6),
                      const Text('Agrega algo de tus favoritos o busca más lugares.', textAlign: TextAlign.center, style: TextStyle(color: Colores.suave)),
                    ],
                  ),
                )
              else
                ReorderableListView(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  buildDefaultDragHandles: false,
                  onReorder: (a, b) => _reordenar(l, visibles, a, b),
                  children: [
                    for (var i = 0; i < visibles.length; i++)
                      _FilaItem(
                        key: ValueKey(visibles[i].itemId),
                        indice: i,
                        item: visibles[i],
                        alAbrir: () {
                          final r = rutaDeItem(visibles[i].tipo, visibles[i].slug);
                          if (r != null) context.push(r);
                        },
                        alMenu: (v) {
                          switch (v) {
                            case 'nota':
                              _editarNota(l, visibles[i]);
                            case 'mover':
                              _moverDeDia(l, visibles[i], dias);
                            case 'quitar':
                              _quitar(l, visibles[i]);
                          }
                        },
                        puedeMover: l.esItinerario && dias > 1,
                      ),
                  ],
                ),
            ],
          ),
          if (_ocupado) const Positioned.fill(child: ColoredBox(color: Color(0x55FBF7EF), child: Center(child: CircularProgressIndicator()))),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colores.linea))),
          child: SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: _ocupado ? null : () => _agregar(l, dia),
              style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
              child: Text(l.esItinerario ? '＋ Agregar al día $dia' : '＋ Agregar a la lista', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChipDia extends StatelessWidget {
  const _ChipDia({required this.texto, required this.activo, required this.alTocar});
  final String texto;
  final bool activo;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Material(
          color: activo ? Colores.tinta : Colors.white,
          shape: StadiumBorder(side: BorderSide(color: activo ? Colores.tinta : Colores.linea, width: 1.5)),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: alTocar,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              child: Text(texto, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: activo ? Colors.white : Colores.tinta)),
            ),
          ),
        ),
      );
}

class _FilaItem extends StatelessWidget {
  const _FilaItem({super.key, required this.indice, required this.item, required this.alAbrir, required this.alMenu, required this.puedeMover});
  final int indice;
  final ListaItem item;
  final VoidCallback alAbrir;
  final ValueChanged<String> alMenu;
  final bool puedeMover;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: alAbrir,
          child: Container(
            padding: const EdgeInsets.fromLTRB(6, 8, 4, 8),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Colores.linea)),
            child: Row(
              children: [
                ReorderableDragStartListener(
                  index: indice,
                  child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 10), child: Icon(Icons.drag_indicator, color: Colores.suave)),
                ),
                FotoNegocio(url: item.imagenUrl, nombre: item.nombre, alto: 58, ancho: 58),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(iconoItem(item.tipo), size: 14, color: Colores.suave),
                          const SizedBox(width: 4),
                          Text(nombreTipoItem(item.tipo), style: const TextStyle(color: Colores.suave, fontSize: 12.5)),
                        ],
                      ),
                      if (item.nota != null) ...[
                        const SizedBox(height: 4),
                        Text(item.nota!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontStyle: FontStyle.italic, color: Colores.barro)),
                      ],
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Colores.suave),
                  onSelected: alMenu,
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'nota', child: Text(item.nota == null ? 'Agregar nota' : 'Editar nota')),
                    if (puedeMover) const PopupMenuItem(value: 'mover', child: Text('Mover de día')),
                    const PopupMenuItem(value: 'quitar', child: Text('Quitar', style: TextStyle(color: Colores.grana))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Hoja para agregar elementos desde los favoritos; se queda abierta para agregar varios.
class _AgregarDeFavoritos extends ConsumerStatefulWidget {
  const _AgregarDeFavoritos({required this.listaId, required this.esItinerario, required this.dia, required this.titulo});
  final String listaId;
  final bool esItinerario;
  final int dia;
  final String titulo;

  @override
  ConsumerState<_AgregarDeFavoritos> createState() => _AgregarDeFavoritosState();
}

class _AgregarDeFavoritosState extends ConsumerState<_AgregarDeFavoritos> {
  final Set<String> _agregados = {};
  String? _trabajando;
  String? _error;

  String _clave(Favorito f) => '${f.tipo}:${f.id}';

  Future<void> _agregar(Favorito f) async {
    setState(() {
      _trabajando = _clave(f);
      _error = null;
    });
    try {
      await ref.read(repositorioListasProvider).agregar(widget.listaId, tipo: f.tipo, id: f.id, dia: widget.esItinerario ? widget.dia : null);
      ref.invalidate(misListasProvider);
      if (mounted) setState(() => _agregados.add(_clave(f)));
    } catch (e) {
      final err = ErrorApi.desde(e);
      if (mounted) {
        setState(() {
          if (err.codigo == 409) {
            _agregados.add(_clave(f));
            _error = 'Ese elemento ya estaba en la lista.';
          } else {
            _error = err.general;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _trabajando = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final favs = ref.watch(favoritosProvider);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 14),
            Text(widget.titulo, style: titulo(21)),
            const SizedBox(height: 4),
            const Text('De tus favoritos', style: TextStyle(color: Colores.suave, fontSize: 13)),
            const SizedBox(height: 10),
            Flexible(
              child: favs.when(
                loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Padding(padding: const EdgeInsets.all(20), child: Text(ErrorApi.desde(e).general, style: const TextStyle(color: Colores.suave))),
                data: (lista) => lista.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: Text('Todavía no tienes favoritos. Guarda algunos con el corazón o busca lugares nuevos.', style: TextStyle(color: Colores.suave, height: 1.4)),
                      )
                    : ListView(
                        shrinkWrap: true,
                        children: [
                          for (final f in lista)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: FotoNegocio(url: f.imagenUrl, nombre: f.nombre, alto: 48, ancho: 48),
                              title: Text(f.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                              subtitle: Text(nombreTipoItem(f.tipo), style: const TextStyle(fontSize: 12.5)),
                              trailing: _agregados.contains(_clave(f))
                                  ? const Icon(Icons.check_circle, color: Colores.ok)
                                  : (_trabajando == _clave(f)
                                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4))
                                      : IconButton(icon: const Icon(Icons.add_circle_outline, color: Colores.grana), onPressed: _trabajando != null ? null : () => _agregar(f))),
                            ),
                        ],
                      ),
              ),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colores.grana, fontSize: 13))),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).pop();
                context.push('/buscar');
              },
              icon: const Icon(Icons.search),
              label: const Text('Buscar más'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colores.tinta,
                minimumSize: const Size.fromHeight(48),
                side: const BorderSide(color: Colores.linea, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
