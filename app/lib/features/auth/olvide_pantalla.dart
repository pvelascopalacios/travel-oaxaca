import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import 'campos.dart';

class OlvidePantalla extends ConsumerStatefulWidget {
  const OlvidePantalla({super.key});

  @override
  ConsumerState<OlvidePantalla> createState() => _OlvidePantallaState();
}

class _OlvidePantallaState extends ConsumerState<OlvidePantalla> {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();
  bool _enviando = false;
  String? _ok;
  ErrorApi? _error;

  @override
  void dispose() {
    _correo.dispose();
    super.dispose();
  }

  Future<void> _pedir() async {
    setState(() {
      _error = null;
      _ok = null;
    });
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      final texto = await ref.read(sesionProvider.notifier).olvideClave(_correo.text);
      if (!mounted) return;
      setState(() => _ok = texto);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = ErrorApi.desde(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recuperar contraseña')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(22),
        child: Form(
          key: _formulario,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.',
                style: TextStyle(height: 1.4),
              ),
              const SizedBox(height: 18),
              if (_error != null) ...[AvisoError(_error!.general), const SizedBox(height: 14)],
              if (_ok != null) ...[AvisoOk(_ok!), const SizedBox(height: 14)],
              TextFormField(
                controller: _correo,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _pedir(),
                decoration: const InputDecoration(labelText: 'Correo'),
                validator: validarCorreo,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _enviando ? null : _pedir,
                child: _enviando
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : const Text('Enviar enlace'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
