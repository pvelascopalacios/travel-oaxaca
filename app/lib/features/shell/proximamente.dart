import 'package:flutter/material.dart';

import '../../core/tema.dart';

/// Lugar reservado de una pantalla que llega en otra entrega.
class Proximamente extends StatelessWidget {
  const Proximamente({super.key, required this.titulo, required this.entrega, required this.icono});

  final String titulo;
  final int entrega;
  final String icono;

  IconData get _icono => icono == 'place' ? Icons.place_outlined : Icons.explore_outlined;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(22)),
                child: Icon(_icono, size: 34, color: Colores.grana),
              ),
              const SizedBox(height: 18),
              Text(titulo, style: titulo_(26)),
              const SizedBox(height: 8),
              Text(
                'Esta pantalla llega en la entrega $entrega de la app.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colores.suave, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }

  TextStyle titulo_(double t) => TextStyle(fontSize: t, fontWeight: FontWeight.w800, color: Colores.tinta);
}
