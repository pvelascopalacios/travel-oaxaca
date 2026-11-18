import 'package:flutter/material.dart';

import '../../core/tema.dart';
import 'ubicacion.dart';

/// Pantalla que explica para qué se usa la ubicación, antes de pedir el permiso.
class PermisoVista extends StatelessWidget {
  const PermisoVista({
    super.key,
    required this.estado,
    required this.alActivar,
    required this.alOmitir,
    required this.alAjustes,
  });

  final EstadoUbicacion estado;
  final VoidCallback alActivar;
  final VoidCallback alOmitir;
  final VoidCallback alAjustes;

  @override
  Widget build(BuildContext context) {
    final p = estado.permiso;
    final (titulo_, texto, boton, accion) = switch (p) {
      PermisoUbicacion.denegadoSiempre => (
          'Activa la ubicación en Ajustes',
          'Bloqueaste el permiso antes. Ábrelo en Ajustes → Permisos → Ubicación y vuelve aquí.',
          'Abrir Ajustes',
          alAjustes,
        ),
      PermisoUbicacion.servicioApagado => (
          'Tu ubicación está apagada',
          'Enciéndela en el teléfono para ver qué hay a unos pasos de ti.',
          'Abrir ajustes de ubicación',
          alAjustes,
        ),
      PermisoUbicacion.denegado => (
          'No pudimos ver dónde estás',
          'Sin tu ubicación no podemos ordenar por cercanía. Puedes intentarlo otra vez o ver el mapa de Oaxaca.',
          'Intentar de nuevo',
          alActivar,
        ),
      _ => (
          'Descubre lo que tienes cerca',
          'Usamos tu ubicación solo para mostrarte hoteles, restaurantes y tours a tu alrededor, con la distancia a pie. No la guardamos.',
          'Activar ubicación',
          alActivar,
        ),
    };

    return Scaffold(
      backgroundColor: Colores.crema,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 0, 28, 90),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 132,
                height: 132,
                decoration: const BoxDecoration(color: Colores.cantera, shape: BoxShape.circle),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(color: Colores.agave.withValues(alpha: 0.12), shape: BoxShape.circle),
                    ),
                    const Icon(Icons.location_on, size: 54, color: Colores.grana),
                  ],
                ),
              ),
              const SizedBox(height: 26),
              Text(titulo_, textAlign: TextAlign.center, style: titulo(24)),
              const SizedBox(height: 10),
              Text(texto, textAlign: TextAlign.center, style: const TextStyle(color: Colores.suave, height: 1.45, fontSize: 15)),
              const SizedBox(height: 26),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                  onPressed: estado.buscando ? null : accion,
                  child: estado.buscando
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                      : Text(boton, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: alOmitir,
                child: const Text('Ahora no · Ver el mapa de Oaxaca', style: TextStyle(color: Colores.suave, fontWeight: FontWeight.w600)),
              ),
              if (p == PermisoUbicacion.sinPreguntar) ...[
                const SizedBox(height: 14),
                const Text(
                  'Puedes cambiarlo cuando quieras en Ajustes del teléfono.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, color: Colores.suave),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
