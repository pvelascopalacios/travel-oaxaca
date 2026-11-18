import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/tema.dart';

/// Pantalla de cuenta: barra con flecha, contenido que se desplaza y botón fijo opcional.
class PantallaCuenta extends StatelessWidget {
  const PantallaCuenta({super.key, required this.titulo, required this.hijos, this.boton, this.alRefrescar});

  final String titulo;
  final List<Widget> hijos;
  final Widget? boton;
  final Future<void> Function()? alRefrescar;

  @override
  Widget build(BuildContext context) {
    final lista = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
      children: hijos,
    );
    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.pop()),
        title: Text(titulo, style: titulo_(18)),
      ),
      body: alRefrescar == null ? lista : RefreshIndicator(onRefresh: alRefrescar!, child: lista),
      bottomNavigationBar: boton == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colores.linea))),
                child: SizedBox(height: 52, child: boton),
              ),
            ),
    );
  }
}

TextStyle titulo_(double t) => titulo(t);

/// Botón principal (grana, de punta a punta). Con [enviando] muestra una ruedita.
class BotonGrana extends StatelessWidget {
  const BotonGrana({super.key, required this.texto, required this.alTocar, this.enviando = false});

  final String texto;
  final VoidCallback? alTocar;
  final bool enviando;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: Colores.grana,
        disabledBackgroundColor: const Color(0xFFE8DCC9),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      ),
      onPressed: enviando ? null : alTocar,
      child: enviando
          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
          : Text(texto, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
    );
  }
}

InputDecoration decoracionCampo(String? pista, {Widget? sufijo, String? error, Widget? prefijo}) => InputDecoration(
      hintText: pista,
      hintStyle: const TextStyle(color: Colores.suave, fontSize: 14),
      errorText: error,
      filled: true,
      fillColor: Colors.white,
      suffixIcon: sufijo,
      prefix: prefijo,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.linea, width: 1.5)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.grana, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.grana, width: 1.5)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.grana, width: 1.5)),
    );

class EtiquetaCampo extends StatelessWidget {
  const EtiquetaCampo(this.texto, {super.key, this.nota});
  final String texto;
  final String? nota;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 8),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: texto, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: Colores.tinta)),
          if (nota != null) TextSpan(text: '  $nota', style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
        ])),
      );
}

class TituloGrupo extends StatelessWidget {
  const TituloGrupo(this.texto, {super.key});
  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
        child: Text(texto.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.7, color: Colores.suave)),
      );
}

/// Tarjeta blanca que agrupa filas.
class GrupoFilas extends StatelessWidget {
  const GrupoFilas({super.key, required this.filas});
  final List<Widget> filas;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colores.linea)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < filas.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: Color(0xFFF0E8D8)),
            filas[i],
          ],
        ],
      ),
    );
  }
}

class FilaAjuste extends StatelessWidget {
  const FilaAjuste({super.key, required this.icono, required this.titulo, this.detalle, this.alTocar, this.final_, this.colorTitulo});

  final IconData icono;
  final String titulo;
  final String? detalle;
  final VoidCallback? alTocar;
  final Widget? final_;
  final Color? colorTitulo;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: alTocar,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: Colores.cantera, borderRadius: BorderRadius.circular(11)),
              child: Icon(icono, size: 19, color: Colores.tinta),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titulo, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, color: colorTitulo ?? Colores.tinta)),
                  if (detalle != null) Padding(padding: const EdgeInsets.only(top: 1), child: Text(detalle!, style: const TextStyle(fontSize: 12, color: Colores.suave))),
                ],
              ),
            ),
            final_ ?? (alTocar != null ? const Icon(Icons.chevron_right, color: Color(0xFFB5A892)) : const SizedBox.shrink()),
          ],
        ),
      ),
    );
  }
}

class AvisoCampo extends StatelessWidget {
  const AvisoCampo(this.texto, {super.key, this.error = true});
  final String texto;
  final bool error;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: error ? Colores.avisoFondo : Colores.okFondo, borderRadius: BorderRadius.circular(14)),
        child: Text(texto, style: TextStyle(color: error ? Colores.grana : Colores.ok, fontWeight: FontWeight.w600, height: 1.35, fontSize: 13.5)),
      );
}

void avisar(BuildContext context, String texto) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(texto)));
}
