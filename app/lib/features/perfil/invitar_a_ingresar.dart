import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/tema.dart';

/// Lo que ve quien navega sin cuenta en las pantallas que sí la piden.
class InvitarAIngresar extends StatelessWidget {
  const InvitarAIngresar({super.key, required this.titulo, required this.texto, required this.icono});

  final String titulo;
  final String texto;
  final IconData icono;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(22)),
                  child: Icon(icono, size: 34, color: Colores.grana),
                ),
              ),
              const SizedBox(height: 18),
              Text(titulo, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(texto, textAlign: TextAlign.center, style: const TextStyle(color: Colores.suave, height: 1.4)),
              const SizedBox(height: 22),
              FilledButton(onPressed: () => context.push('/ingresar'), child: const Text('Ingresar')),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: () => context.push('/registro'), child: const Text('Crear cuenta')),
            ],
          ),
        ),
      ),
    );
  }
}
