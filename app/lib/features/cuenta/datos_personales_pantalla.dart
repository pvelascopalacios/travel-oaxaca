import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart' show EstadoVacio;
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

/// Perfil → Datos personales: nombre, teléfono e idioma.
class DatosPersonalesPantalla extends ConsumerWidget {
  const DatosPersonalesPantalla({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilCuentaProvider);
    return perfil.when(
      loading: () => const PantallaCuenta(titulo: 'Datos personales', hijos: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (e, _) => PantallaCuenta(
        titulo: 'Datos personales',
        hijos: [
          SizedBox(
            height: 380,
            child: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: ErrorApi.desde(e).general, accion: () => ref.invalidate(perfilCuentaProvider)),
          ),
        ],
      ),
      data: (p) => _Formulario(perfil: p),
    );
  }
}

class _Formulario extends ConsumerStatefulWidget {
  const _Formulario({required this.perfil});
  final PerfilCuenta perfil;

  @override
  ConsumerState<_Formulario> createState() => _FormularioState();
}

class _FormularioState extends ConsumerState<_Formulario> {
  late final TextEditingController _nombre = TextEditingController(text: widget.perfil.nombre);
  late final TextEditingController _telefono = TextEditingController(text: telefonoParaMostrar(widget.perfil.telefonoE164));
  late String _idioma = widget.perfil.idiomaCodigo;
  bool _enviando = false;
  String? _error;
  Map<String, String> _campos = const {};

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    super.dispose();
  }

  bool get _cambio =>
      _nombre.text.trim() != widget.perfil.nombre ||
      telefonoE164Mexico(_telefono.text) != widget.perfil.telefonoE164 ||
      _idioma != widget.perfil.idiomaCodigo;

  bool get _puede => !_enviando && _nombre.text.trim().isNotEmpty && telefonoValido(_telefono.text) && _cambio;

  Future<void> _guardar() async {
    setState(() {
      _enviando = true;
      _error = null;
      _campos = const {};
    });
    final mensajes = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final p = await ref.read(repositorioCuentaProvider).guardarPerfil(
            nombre: _nombre.text,
            telefonoE164: telefonoE164Mexico(_telefono.text),
            idiomaCodigo: _idioma,
          );
      await ref.read(sesionProvider.notifier).aplicarUsuario(p.aUsuario());
      ref.invalidate(perfilCuentaProvider);
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Guardamos tus datos.')));
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
    final p = widget.perfil;
    final idiomas = ref.watch(idiomasProvider).valueOrNull?.where((i) => !i.esIndigena).toList() ?? const <IdiomaApp>[];
    final lista = idiomas.isEmpty ? [const IdiomaApp(codigo: 'es', nombre: 'Español')] : idiomas;
    return PantallaCuenta(
      titulo: 'Datos personales',
      boton: BotonGrana(texto: 'Guardar cambios', enviando: _enviando, alTocar: _puede ? _guardar : null),
      hijos: [
        Center(
          child: CircleAvatar(
            radius: 42,
            backgroundColor: const Color(0xFFFBE8EE),
            child: Text(p.nombre.trim().isEmpty ? '?' : p.nombre.trim()[0].toUpperCase(),
                style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: Colores.grana)),
          ),
        ),
        const EtiquetaCampo('Nombre'),
        TextField(
          controller: _nombre,
          maxLength: 120,
          textCapitalization: TextCapitalization.words,
          onChanged: (_) => setState(() {}),
          decoration: decoracionCampo(null, error: _campos['nombre']).copyWith(counterText: ''),
        ),
        const EtiquetaCampo('Correo'),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(color: const Color(0xFFF6F0E4), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colores.linea, width: 1.5)),
          child: Row(
            children: [
              Expanded(child: Text(p.correo, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colores.suave))),
              Text(p.correoVerificado ? 'Confirmado' : 'Sin confirmar',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: p.correoVerificado ? Colores.ok : Colores.grana)),
            ],
          ),
        ),
        const Padding(padding: EdgeInsets.only(top: 6), child: Text('El correo no se puede cambiar desde la app.', style: TextStyle(fontSize: 12, color: Colores.suave))),
        const EtiquetaCampo('Teléfono', nota: '(opcional)'),
        TextField(
          controller: _telefono,
          keyboardType: TextInputType.phone,
          onChanged: (_) => setState(() {}),
          decoration: decoracionCampo('954 123 4567', prefijo: const Padding(padding: EdgeInsets.only(right: 8), child: Text('🇲🇽 +52  ', style: TextStyle(fontWeight: FontWeight.w800, color: Colores.tinta))))
              .copyWith(
            errorText: _campos['telefonoE164'] ?? (telefonoValido(_telefono.text) ? null : 'Escribe 10 dígitos.'),
          ),
        ),
        const EtiquetaCampo('Idioma'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final i in lista)
              ChoiceChip(
                label: Text(i.nombre),
                selected: _idioma == i.codigo,
                selectedColor: Colores.tinta,
                backgroundColor: Colors.white,
                side: BorderSide(color: _idioma == i.codigo ? Colores.tinta : Colores.linea, width: 1.5),
                labelStyle: TextStyle(fontWeight: FontWeight.w700, color: _idioma == i.codigo ? Colors.white : Colores.tinta),
                showCheckmark: false,
                onSelected: (_) => setState(() => _idioma = i.codigo),
              ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text('Guarda tu preferencia. Por ahora la app se ve solo en español.', style: TextStyle(fontSize: 12, color: Colores.suave)),
        ),
        if (_error != null) AvisoCampo(_error!),
      ],
    );
  }
}
