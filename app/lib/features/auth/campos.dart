import 'package:flutter/material.dart';

import '../../core/tema.dart';

/// Cabecera grana-maíz de las pantallas de acceso.
class CabeceraAcceso extends StatelessWidget {
  const CabeceraAcceso({super.key, required this.titulo, required this.subtitulo, this.alto = 230});

  final String titulo;
  final String subtitulo;
  final double alto;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: alto,
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 26),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colores.grana, Colores.maiz],
        ),
        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(40), bottomRight: Radius.circular(40)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: titulo_(30, Colors.white)),
          const SizedBox(height: 6),
          Text(subtitulo, style: const TextStyle(color: Colors.white70, fontSize: 13.5, height: 1.35)),
        ],
      ),
    );
  }

  TextStyle titulo_(double t, Color c) => TextStyle(fontSize: t, fontWeight: FontWeight.w800, color: c, height: 1.1);
}

/// Franja con el error general (el de la API o el de conexión).
class AvisoError extends StatelessWidget {
  const AvisoError(this.texto, {super.key});
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colores.avisoFondo,
        borderRadius: BorderRadius.circular(12),
        border: const Border(left: BorderSide(color: Colores.grana, width: 4)),
      ),
      child: Text(texto, style: const TextStyle(fontSize: 13.5, height: 1.35)),
    );
  }
}

/// Franja con un aviso bueno (por ejemplo, «te enviamos un enlace»).
class AvisoOk extends StatelessWidget {
  const AvisoOk(this.texto, {super.key});
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colores.okFondo,
        borderRadius: BorderRadius.circular(12),
        border: const Border(left: BorderSide(color: Colores.ok, width: 4)),
      ),
      child: Text(texto, style: const TextStyle(fontSize: 13.5, height: 1.35)),
    );
  }
}

/// Reglas de validación sencillas, con los mismos textos que la API.
String? validarCorreo(String? v) {
  final t = (v ?? '').trim();
  if (t.isEmpty) return 'Escribe tu correo.';
  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(t)) return 'Escribe un correo válido.';
  return null;
}
