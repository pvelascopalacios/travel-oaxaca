import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../detalle/modelos.dart';
import '../detalle/repositorio.dart';
import '../detalle/widgets.dart';
import '../explorar/widgets.dart';
import 'invitar_a_ingresar.dart';

class FavoritosPantalla extends ConsumerStatefulWidget {
  const FavoritosPantalla({super.key});

  @override
  ConsumerState<FavoritosPantalla> createState() => _FavoritosPantallaState();
}

class _FavoritosPantallaState extends ConsumerState<FavoritosPantalla> {
  String _filtro = 'todos';

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionProvider);
    final usuario = sesion.valueOrNull;
    if (sesion.isLoading && usuario == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (usuario == null) {
      return const InvitarAIngresar(
        titulo: 'Tus favoritos',
        texto: 'Ingresa para guardar los negocios, lugares y rutas que te gusten y verlos aquí.',
        icono: Icons.favorite_border,
      );
    }
    final favs = ref.watch(favoritosProvider);
    return SafeArea(
      bottom: false,
      child: favs.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoVacio(
          icono: Icons.cloud_off_outlined,
          titulo: 'No pudimos cargar',
          texto: ErrorApi.desde(e).general,
          accion: () => ref.invalidate(favoritosProvider),
        ),
        data: (todos) {
          final lista = _filtro == 'todos' ? todos : todos.where((f) => f.tipo == _filtro).toList();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Mis favoritos', style: titulo(28)),
                    const SizedBox(height: 2),
                    Text('Guardados en tu cuenta · ${todos.length}', style: const TextStyle(color: Colores.suave, fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  children: [
                    for (final op in const [('todos', 'Todos'), ('negocio', 'Negocios'), ('lugar', 'Lugares'), ('ruta', 'Rutas')])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(op.$2),
                          selected: _filtro == op.$1,
                          onSelected: (_) => setState(() => _filtro = op.$1),
                          selectedColor: Colores.tinta,
                          backgroundColor: Colors.white,
                          showCheckmark: false,
                          labelStyle: TextStyle(fontWeight: FontWeight.w700, color: _filtro == op.$1 ? Colors.white : Colores.tinta),
                          side: BorderSide(color: _filtro == op.$1 ? Colores.tinta : Colores.linea, width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: lista.isEmpty
                    ? EstadoVacio(
                        icono: Icons.favorite_border,
                        titulo: todos.isEmpty ? 'Aún no guardas nada' : 'Nada en esta lista',
                        texto: 'Toca el corazón de un negocio o lugar para guardarlo aquí.',
                        accion: () => context.go('/explorar'),
                        textoAccion: 'Explorar',
                      )
                    : RefreshIndicator(
                        color: Colores.grana,
                        onRefresh: () async {
                          ref.invalidate(favoritosProvider);
                          await ref.read(favoritosProvider.future);
                        },
                        child: ListView.separated(
                          padding: EdgeInsets.fromLTRB(18, 4, 18, MediaQuery.of(context).padding.bottom + 16),
                          itemCount: lista.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => _FilaFavorito(fav: lista[i]),
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FilaFavorito extends StatelessWidget {
  const _FilaFavorito({required this.fav});
  final Favorito fav;

  String get _tipo => fav.tipo == 'negocio' ? 'Negocio' : (fav.tipo == 'lugar' ? 'Lugar' : 'Ruta');

  void _abrir(BuildContext context) {
    switch (fav.tipo) {
      case 'negocio':
        context.push('/negocio/${fav.slug}');
        break;
      case 'lugar':
        context.push('/lugar/${fav.slug}');
        break;
      default:
        context.push('/ruta/${fav.slug}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => _abrir(context),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Colores.linea)),
          child: Row(
            children: [
              FotoNegocio(url: fav.imagenUrl, nombre: fav.nombre, alto: 72, ancho: 72),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(20)),
                      child: Text(_tipo, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colores.grana)),
                    ),
                    const SizedBox(height: 5),
                    Text(fav.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(16)),
                  ],
                ),
              ),
              BotonCorazon(tipo: fav.tipo, id: fav.id, nombre: fav.nombre, slug: fav.slug, imagenUrl: fav.imagenUrl, sombra: false),
            ],
          ),
        ),
      ),
    );
  }
}
