import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import 'campos.dart';

class IngresarPantalla extends ConsumerStatefulWidget {
  const IngresarPantalla({super.key});

  @override
  ConsumerState<IngresarPantalla> createState() => _IngresarPantallaState();
}

class _IngresarPantallaState extends ConsumerState<IngresarPantalla> {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();
  final _clave = TextEditingController();
  bool _ver = false;
  bool _enviando = false;
  ErrorApi? _error;

  @override
  void dispose() {
    _correo.dispose();
    _clave.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).ingresar(_correo.text, _clave.text);
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/explorar');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = ErrorApi.desde(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final campos = _error?.campos ?? const <String, String>{};
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            const CabeceraAcceso(
              titulo: 'Guarda lo que\nte gusta de Oaxaca',
              subtitulo: 'Con tu cuenta guardas favoritos, comentas y reseñas.',
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[AvisoError(_error!.general), const SizedBox(height: 14)],
                    TextFormField(
                      controller: _correo,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(labelText: 'Correo', errorText: campos['correo']),
                      validator: validarCorreo,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _clave,
                      obscureText: !_ver,
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _entrar(),
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        errorText: campos['clave'],
                        suffixIcon: IconButton(
                          tooltip: _ver ? 'Ocultar contraseña' : 'Ver contraseña',
                          icon: Icon(_ver ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          onPressed: () => setState(() => _ver = !_ver),
                        ),
                      ),
                      validator: (v) => (v ?? '').isEmpty ? 'Escribe tu contraseña.' : null,
                    ),
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _enviando ? null : _entrar,
                      child: _enviando
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 6),
                    TextButton(onPressed: () => context.push('/olvide-clave'), child: const Text('¿Olvidaste tu contraseña?')),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('¿Sin cuenta?', style: TextStyle(color: Colores.suave)),
                        TextButton(onPressed: () => context.push('/registro'), child: const Text('Crear cuenta')),
                      ],
                    ),
                    const Divider(color: Colores.linea, height: 28),
                    TextButton(
                      onPressed: () => context.go('/explorar'),
                      style: TextButton.styleFrom(foregroundColor: Colores.suave),
                      child: const Text('Seguir explorando sin cuenta →'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
