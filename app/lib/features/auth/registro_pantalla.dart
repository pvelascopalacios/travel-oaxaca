import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import 'campos.dart';

class RegistroPantalla extends ConsumerStatefulWidget {
  const RegistroPantalla({super.key});

  @override
  ConsumerState<RegistroPantalla> createState() => _RegistroPantallaState();
}

class _RegistroPantallaState extends ConsumerState<RegistroPantalla> {
  final _formulario = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _correo = TextEditingController();
  final _clave = TextEditingController();
  bool _ver = false;
  bool _acepta = false;
  bool _faltoAceptar = false;
  bool _enviando = false;
  ErrorApi? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _correo.dispose();
    _clave.dispose();
    super.dispose();
  }

  Future<void> _crear() async {
    setState(() {
      _error = null;
      _faltoAceptar = false;
    });
    final valido = _formulario.currentState!.validate();
    if (!_acepta) setState(() => _faltoAceptar = true);
    if (!valido || !_acepta) return;
    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).registrar(
            nombre: _nombre.text,
            correo: _correo.text,
            clave: _clave.text,
            aceptaTerminos: _acepta,
          );
      if (!mounted) return;
      context.go('/explorar');
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
              titulo: 'Crea tu cuenta',
              subtitulo: 'Es gratis. Guarda favoritos, comenta y reseña lo que conozcas.',
              alto: 200,
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
                      controller: _nombre,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(labelText: 'Nombre', errorText: campos['nombre']),
                      validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe tu nombre.' : null,
                    ),
                    const SizedBox(height: 14),
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
                      autofillHints: const [AutofillHints.newPassword],
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        errorText: campos['clave'],
                        suffixIcon: IconButton(
                          tooltip: _ver ? 'Ocultar contraseña' : 'Ver contraseña',
                          icon: Icon(_ver ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          onPressed: () => setState(() => _ver = !_ver),
                        ),
                      ),
                      validator: (v) => (v ?? '').isEmpty ? 'Escribe una contraseña.' : null,
                    ),
                    const SizedBox(height: 10),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: Colores.grana,
                      value: _acepta,
                      onChanged: (v) => setState(() => _acepta = v ?? false),
                      title: const Text('Acepto los términos y el aviso de privacidad.', style: TextStyle(fontSize: 13.5)),
                      subtitle: (_faltoAceptar || campos['aceptaTerminos'] != null)
                          ? Text(campos['aceptaTerminos'] ?? 'Debes aceptar los términos y el aviso de privacidad.',
                              style: const TextStyle(color: Colores.grana, fontSize: 12.5))
                          : null,
                    ),
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: _enviando ? null : _crear,
                      child: _enviando
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                          : const Text('Crear cuenta'),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('¿Ya tienes cuenta?', style: TextStyle(color: Colores.suave)),
                        TextButton(onPressed: () => context.pop(), child: const Text('Entrar')),
                      ],
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
