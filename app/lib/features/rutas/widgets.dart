import 'package:flutter/material.dart';

import '../../core/tema.dart';
import '../detalle/widgets.dart' show BotonCorazon;
import '../explorar/widgets.dart' show tonoDe;
import 'modelos.dart';
import 'utiles.dart';

class PildoraRuta extends StatelessWidget {
  const PildoraRuta(this.texto, {super.key, this.icono, this.fondo = Colores.cantera, this.color = Colores.tinta});
  final String texto;
  final IconData? icono;
  final Color fondo;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icono != null) ...[Icon(icono, size: 13, color: color), const SizedBox(width: 4)],
            Text(texto, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      );
}

Color fondoDificultad(String? d) => switch (d) {
      'facil' => Colores.okFondo,
      'moderada' => const Color(0xFFFBF3DF),
      'dificil' => Colores.avisoFondo,
      _ => Colores.cantera,
    };

Color colorDificultad(String? d) => switch (d) {
      'facil' => Colores.ok,
      'moderada' => const Color(0xFF8A6100),
      'dificil' => Colores.grana,
      _ => Colores.tinta,
    };

/// Las píldoras de datos de una ruta: duración, distancia, dificultad y transporte.
class DatosRuta extends StatelessWidget {
  const DatosRuta({super.key, required this.ruta});
  final RutaTarjeta ruta;

  @override
  Widget build(BuildContext context) {
    final d = textoDuracion(ruta.duracionHoras);
    final k = textoKm(ruta.distanciaKm);
    final dif = nombreDificultad(ruta.dificultad);
    final tr = nombreTransporte(ruta.transporte);
    return Wrap(
      spacing: 7,
      runSpacing: 6,
      children: [
        if (d.isNotEmpty) PildoraRuta(d, icono: Icons.schedule),
        if (k.isNotEmpty) PildoraRuta(k, icono: Icons.straighten),
        if (dif.isNotEmpty) PildoraRuta(dif, fondo: fondoDificultad(ruta.dificultad), color: colorDificultad(ruta.dificultad)),
        if (tr.isNotEmpty) PildoraRuta(tr, icono: iconoTransporte(ruta.transporte)),
      ],
    );
  }
}

/// Fondo de color con el icono del transporte (las rutas no traen foto).
class PortadaRuta extends StatelessWidget {
  const PortadaRuta({super.key, required this.ruta, this.alto = 120, this.icono = 38});
  final RutaTarjeta ruta;
  final double alto;
  final double icono;

  @override
  Widget build(BuildContext context) {
    final tono = tonoDe(ruta.nombre);
    return Container(
      height: alto,
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [tono.withValues(alpha: 0.92), tono.withValues(alpha: 0.55)]),
      ),
      alignment: Alignment.center,
      child: Icon(iconoTransporte(ruta.transporte), size: icono, color: Colors.white.withValues(alpha: 0.85)),
    );
  }
}

class TarjetaRuta extends StatelessWidget {
  const TarjetaRuta({super.key, required this.ruta, required this.alTocar});
  final RutaTarjeta ruta;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: alTocar,
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  PortadaRuta(ruta: ruta),
                  if (ruta.esPremium)
                    Positioned(
                      left: 10,
                      top: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colores.tinta, borderRadius: BorderRadius.circular(999)),
                        child: const Text('★ Premium', style: TextStyle(color: Colores.maiz, fontWeight: FontWeight.w800, fontSize: 11)),
                      ),
                    ),
                  Positioned(right: 10, top: 10, child: BotonCorazon(tipo: 'ruta', id: ruta.id, nombre: ruta.nombre, slug: ruta.slug, tam: 34)),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ruta.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(17)),
                    if ((ruta.descripcion ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(ruta.descripcion!.trim(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave, height: 1.35)),
                    ],
                    const SizedBox(height: 10),
                    DatosRuta(ruta: ruta),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
