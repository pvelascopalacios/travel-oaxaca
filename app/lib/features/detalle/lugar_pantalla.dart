import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/enlaces.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart';
import '../listas/guardar_en.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'widgets.dart';

class LugarPantalla extends ConsumerWidget {
  const LugarPantalla({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(lugarProvider(slug));
    return datos.when(
      loading: () => const PantallaCargando(),
      error: (e, _) => PantallaError(error: e, reintentar: () => ref.invalidate(lugarProvider(slug))),
      data: (l) => _Lugar(lugar: l),
    );
  }
}

class _Lugar extends StatelessWidget {
  const _Lugar({required this.lugar});
  final LugarDetalle lugar;

  Widget _bloque(String titulo, String? texto) {
    if ((texto ?? '').trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: TarjetaBlanca(
        hijo: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: _t(18)),
            const SizedBox(height: 6),
            Text(texto!.trim(), style: const TextStyle(fontSize: 14, height: 1.5)),
          ],
        ),
      ),
    );
  }

  TextStyle _t(double n) => titulo(n);

  @override
  Widget build(BuildContext context) {
    final l = lugar;
    final puede = l.latitud != null && l.longitud != null;
    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                CabeceraFoto(
                  fotos: l.fotos,
                  nombre: l.nombre,
                  corazon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      BotonGuardarEn(tipo: 'lugar', id: l.id, nombre: l.nombre),
                      const SizedBox(width: 10),
                      BotonCorazon(
                        tipo: 'lugar',
                        id: l.id,
                        nombre: l.nombre,
                        slug: l.slug,
                        imagenUrl: l.fotos.isEmpty ? null : l.fotos.first.url,
                        tam: 42,
                      ),
                    ],
                  ),
                ),
                SliverToBoxAdapter(
                  child: Container(
                    color: Colores.crema,
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if ((l.tipo ?? '').isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(20)),
                            child: Text(l.tipo!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colores.grana)),
                          ),
                        const SizedBox(height: 8),
                        Text(l.nombre, style: titulo(28)),
                        const SizedBox(height: 4),
                        Text(l.subtitulo, style: const TextStyle(fontSize: 13.5, color: Colores.suave)),
                        if ((l.resumen ?? '').isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Text(l.resumen!, style: const TextStyle(fontSize: 14.5, height: 1.5)),
                        ],
                        _bloque('Historia', l.historia),
                        _bloque('Recomendaciones', l.recomendaciones),
                        _bloque('Mejor época para ir', l.mejorEpoca),
                        _bloque('Cómo llegar', l.comoLlegar),
                        if (l.atractivos.isNotEmpty) ...[
                          const SizedBox(height: 24),
                          const TituloSeccion('Qué ver aquí'),
                          const SizedBox(height: 10),
                          for (final a in l.atractivos)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: TarjetaLugarFila(lugar: a, alTocar: () => context.push('/lugar/${a.slug}')),
                            ),
                        ],
                        if (l.negociosCercanos.isNotEmpty) ...[
                          const SizedBox(height: 24),
                          const TituloSeccion('Negocios cerca'),
                          const SizedBox(height: 10),
                          for (final n in l.negociosCercanos)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: TarjetaNegocioFila(negocio: n, alTocar: () => context.push('/negocio/${n.slug}')),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (puede)
            BarraAccion(
              hijos: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => Enlaces.comoLlegar(context, l.latitud!, l.longitud!),
                    icon: const Icon(Icons.directions_outlined, size: 20),
                    label: const Text('Cómo llegar'),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
