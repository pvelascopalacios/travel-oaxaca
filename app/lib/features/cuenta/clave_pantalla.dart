import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

/// Perfil → Contraseña.
class ClavePantalla extends ConsumerStatefulWidget {
  const ClavePantalla({super.key});

  @override
  ConsumerState<ClavePantalla> createState() => _ClavePantallaState();
}

class _ClavePantallaState extends ConsumerState<ClavePantalla> {
  final _actual = TextEditingController();
  final _nueva = TextEditingController();
  final _repite = TextEditingController();
  bool _verActual = false;
  bool _verNueva = false;
  bool _enviando = false;
  String? _error;
  Map<String, String> _campos = const {};

  @override
  void dispose() {
    _actual.dispose();
    _nueva.dispose();
    _repite.dispose();
    super.dispose();
  }

  bool get _coinciden => _nueva.text == _repite.text;
  bool get _puede => !_enviando && _actual.text.isNotEmpty && _nueva.text.runes.length >= claveMinima && _repite.text.isNotEmpty && _coinciden;

  Future<void> _cambiar() async {
    setState(() {
      _enviando = true;
      _error = null;
      _campos = const {};
    });
    final mensajes = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      await ref.read(repositorioCuentaProvider).cambiarClave(_actual.text, _nueva.text);
      ref.invalidate(sesionesProvider);
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Contraseña actualizada.')));
      router.pop();
    } catch (e) {
      final err = ErrorApi.desde(e);
      if (mounted) {
        setState(() {
          _enviando = false;
          _campos = err.campos;
          _error = err.campos.isEmpty ? err.general : null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fuerza = fuerzaClave(_nueva.text);
    final colorFuerza = fuerza <= 1 ? Colores.grana : (fuerza == 2 ? Colores.maiz : Colores.ok);
    return PantallaCuenta(
      titulo: 'Contraseña',
      boton: BotonGrana(texto: 'Cambiar contraseña', enviando: _enviando, alTocar: _puede ? _cambiar : null),
      hijos: [
        const EtiquetaCampo('Contraseña actual'),
        TextField(
          controller: _actual,
          obscureText: !_verActual,
          autocorrect: false,
          enableSuggestions: false,
          onChanged: (_) => setState(() {}),
          decoration: decoracionCampo(null, error: _campos['claveActual'], sufijo: _Ojo(visible: _verActual, alTocar: () => setState(() => _verActual = !_verActual))),
        ),
        const EtiquetaCampo('Contraseña nueva'),
        TextField(
          controller: _nueva,
          obscureText: !_verNueva,
          autocorrect: false,
          enableSuggestions: false,
          onChanged: (_) => setState(() {}),
          decoration: decoracionCampo('Mínimo $claveMinima caracteres', error: _campos['claveNueva'], sufijo: _Ojo(visible: _verNueva, alTocar: () => setState(() => _verNueva = !_verNueva))),
        ),
        if (_nueva.text.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 1; i <= 4; i++)
                Expanded(
                  child: Container(
                    height: 5,
                    margin: EdgeInsets.only(right: i < 4 ? 5 : 0),
                    decoration: BoxDecoration(color: i <= fuerza ? colorFuerza : const Color(0xFFE3D8C4), borderRadius: BorderRadius.circular(3)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Text(textoFuerza(_nueva.text), style: const TextStyle(fontSize: 12, color: Colores.suave)),
        ],
        const EtiquetaCampo('Repite la contraseña nueva'),
        TextField(
          controller: _repite,
          obscureText: !_verNueva,
          autocorrect: false,
          enableSuggestions: false,
          onChanged: (_) => setState(() {}),
          decoration: decoracionCampo(null,
              error: _repite.text.isNotEmpty && !_coinciden ? 'No coinciden.' : null,
              sufijo: _repite.text.isNotEmpty && _coinciden ? const Icon(Icons.check_circle, color: Colores.ok) : null),
        ),
        Container(
          margin: const EdgeInsets.only(top: 18),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colores.cantera, borderRadius: BorderRadius.circular(14)),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.shield_outlined, size: 17, color: Colores.suave),
              SizedBox(width: 8),
              Expanded(
                child: Text('Al cambiarla cerramos tu sesión en tus otros dispositivos. En este seguirás dentro.',
                    style: TextStyle(fontSize: 12.5, color: Colores.suave, height: 1.4)),
              ),
            ],
          ),
        ),
        if (_error != null) AvisoCampo(_error!),
      ],
    );
  }
}

class _Ojo extends StatelessWidget {
  const _Ojo({required this.visible, required this.alTocar});
  final bool visible;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) =>
      IconButton(icon: Icon(visible ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: Colores.suave), onPressed: alTocar);
}
