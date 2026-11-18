import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'tema.dart';

/// Pequeños ajustes para que en iPhone los diálogos y selectores se sientan de iOS.
/// El resto de la app se ve igual en las dos plataformas a propósito (es el diseño de la marca).
bool esIos(BuildContext context) => Theme.of(context).platform == TargetPlatform.iOS;

/// Pregunta de sí/no. Devuelve true solo si la persona confirma.
Future<bool> confirmar(
  BuildContext context, {
  required String titulo,
  required String texto,
  required String si,
  String no = 'Cancelar',
  bool peligro = false,
}) async {
  if (esIos(context)) {
    final r = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(titulo),
        content: Padding(padding: const EdgeInsets.only(top: 6), child: Text(texto)),
        actions: [
          CupertinoDialogAction(onPressed: () => Navigator.pop(ctx, false), child: Text(no)),
          CupertinoDialogAction(isDestructiveAction: peligro, isDefaultAction: !peligro, onPressed: () => Navigator.pop(ctx, true), child: Text(si)),
        ],
      ),
    );
    return r == true;
  }
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.white,
      title: Text(titulo),
      content: Text(texto),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(no)),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(si, style: TextStyle(color: peligro ? Colores.grana : null, fontWeight: FontWeight.w800))),
      ],
    ),
  );
  return r == true;
}

/// Selector de fecha: ruleta en iPhone, calendario en Android. Devuelve null si se cancela.
Future<DateTime?> elegirFecha(
  BuildContext context, {
  required DateTime inicial,
  required DateTime primera,
  required DateTime ultima,
  String? ayuda,
}) async {
  DateTime acotar(DateTime d) => d.isBefore(primera) ? primera : (d.isAfter(ultima) ? ultima : d);
  final ini = acotar(inicial);
  if (!esIos(context)) {
    return showDatePicker(context: context, initialDate: ini, firstDate: primera, lastDate: ultima, helpText: ayuda);
  }
  var elegida = ini;
  return showCupertinoModalPopup<DateTime>(
    context: context,
    builder: (ctx) => Container(
      height: 330,
      color: CupertinoColors.systemBackground.resolveFrom(ctx),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  CupertinoButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
                  Expanded(
                    child: Text(ayuda ?? '', textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, color: Colores.suave, decoration: TextDecoration.none, fontWeight: FontWeight.w500)),
                  ),
                  CupertinoButton(onPressed: () => Navigator.pop(ctx, elegida), child: const Text('Listo', style: TextStyle(fontWeight: FontWeight.w700))),
                ],
              ),
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: ini,
                minimumDate: primera,
                maximumDate: ultima,
                onDateTimeChanged: (d) => elegida = d,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
