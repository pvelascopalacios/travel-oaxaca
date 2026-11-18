import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/enlaces.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart';
import 'repositorio.dart';
import 'widgets.dart';

class EventoPantalla extends ConsumerWidget {
  const EventoPantalla({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(eventoProvider(slug));
    return datos.when(
      loading: () => const PantallaCargando(),
      error: (e, _) => PantallaError(error: e, reintentar: () => ref.invalidate(eventoProvider(slug))),
      data: (d) {
        final e = d.tarjeta;
        final puede = d.latitud != null && d.longitud != null;
        return Scaffold(
          body: Column(
            children: [
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    Container(
                      padding: EdgeInsets.fromLTRB(18, MediaQuery.of(context).padding.top + 12, 18, 26),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFF2C46B), Color(0xFFD07A2A), Color(0xFFA5174F)],
                        ),
                        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          BotonVidrio(icono: Icons.arrow_back, alTocar: () => volver(context)),
                          const SizedBox(height: 26),
                          BloqueFecha(evento: e, tam: 70),
                          const SizedBox(height: 14),
                          if ((e.temporadaNombre ?? '').isNotEmpty)
                            Text(e.temporadaNombre!, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(e.nombre, style: titulo(30, color: Colors.white)),
                          const SizedBox(height: 8),
                          Text(
                            [e.fechasTexto, if (e.lugarTexto.isNotEmpty) e.lugarTexto].join(' · '),
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if ((e.descripcion ?? '').isNotEmpty) Text(e.descripcion!, style: const TextStyle(fontSize: 14.5, height: 1.5)),
                          if (d.negocios.isNotEmpty) ...[
                            const SizedBox(height: 24),
                            const TituloSeccion('Negocios del evento'),
                            const SizedBox(height: 10),
                            for (final n in d.negocios)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: TarjetaNegocioFila(negocio: n, alTocar: () => context.push('/negocio/${n.slug}')),
                              ),
                          ],
                        ],
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
                        onPressed: () => Enlaces.comoLlegar(context, d.latitud!, d.longitud!),
                        icon: const Icon(Icons.directions_outlined, size: 20),
                        label: const Text('Cómo llegar'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
