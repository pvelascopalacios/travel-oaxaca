import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart' show EstadoVacio;
import '../perfil/invitar_a_ingresar.dart';
import 'formulario_lista.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';

/// Mis itinerarios y listas.
class MisListasPantalla extends ConsumerWidget {
  const MisListasPantalla({super.key});

  Future<void> _crear(BuildContext context, {bool itinerario = false}) async {
    final r = await mostrarFormularioLista(context, itinerarioInicial: itinerario);
    if (r != null && context.mounted) context.push('/lista/${r.id}');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(sesionProvider).valueOrNull;
    final listas = ref.watch(misListasProvider);
    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.canPop() ? context.pop() : context.go('/perfil')),
        title: Text('Mis listas', style: titulo(18)),
        actions: [
          if (usuario != null) IconButton(icon: const Icon(Icons.add_circle_outline), tooltip: 'Nueva', onPressed: () => _crear(context)),
        ],
      ),
      body: usuario == null
          ? const InvitarAIngresar(icono: Icons.calendar_month_outlined, titulo: 'Arma tu viaje', texto: 'Ingresa para crear listas e itinerarios.')
          : listas.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => EstadoVacio(
                icono: Icons.cloud_off,
                titulo: 'No pudimos cargar tus listas',
                texto: ErrorApi.desde(e).general,
                accion: () => ref.invalidate(misListasProvider),
              ),
              data: (datos) {
                if (datos.isEmpty) {
                  return EstadoVacio(
                    icono: Icons.calendar_month_outlined,
                    titulo: 'Aún no tienes listas',
                    texto: 'Crea un itinerario para organizar tu viaje por día, o una lista para guardar lo que quieres conocer.',
                    accion: () => _crear(context, itinerario: true),
                    textoAccion: 'Crear mi primer itinerario',
                  );
                }
                final itins = datos.where((l) => l.esItinerario).toList();
                final otras = datos.where((l) => !l.esItinerario).toList();
                return RefreshIndicator(
                  onRefresh: () async { await ref.refresh(misListasProvider.future); },
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
                    children: [
                      if (itins.isNotEmpty) ...[
                        const _Titulo('Itinerarios'),
                        for (final l in itins) _TarjetaLista(lista: l),
                      ],
                      if (otras.isNotEmpty) ...[
                        const _Titulo('Listas'),
                        for (final l in otras) _TarjetaLista(lista: l),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 16, 4, 10),
        child: Text(texto.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.7, color: Colores.suave)),
      );
}

class _TarjetaLista extends StatelessWidget {
  const _TarjetaLista({required this.lista});
  final ListaResumen lista;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/lista/${lista.id}'),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Colores.linea)),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(color: lista.esItinerario ? Colores.avisoFondo : Colores.cantera, borderRadius: BorderRadius.circular(14)),
                  child: Icon(lista.esItinerario ? Icons.calendar_month_outlined : Icons.bookmark_border, color: lista.esItinerario ? Colores.grana : Colores.tinta),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lista.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(16.5)),
                      const SizedBox(height: 3),
                      Text(tipoLista(lista), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colores.suave, fontSize: 12.5)),
                      Text(detalleLista(lista), style: const TextStyle(color: Colores.suave, fontSize: 12.5)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colores.suave),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
