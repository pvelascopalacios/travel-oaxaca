import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../detalle/modelos.dart';
import '../detalle/repositorio.dart';
import '../explorar/widgets.dart';
import 'utiles.dart';

/// Lo mínimo del negocio que necesita la pantalla de reseña.
class NegocioParaResena {
  const NegocioParaResena({required this.id, required this.slug, required this.nombre, this.subtitulo, this.categoriaClave, this.portadaUrl});

  final String id;
  final String slug;
  final String nombre;
  final String? subtitulo;
  final String? categoriaClave;
  final String? portadaUrl;
}

class EscribirResenaArgs {
  const EscribirResenaArgs({required this.negocio, this.existente});
  final NegocioParaResena negocio;
  final ResenaPropia? existente;
}

/// Pantalla para escribir, editar o eliminar mi reseña. Cierra con `true` si algo cambió.
class EscribirResenaPantalla extends ConsumerStatefulWidget {
  const EscribirResenaPantalla({super.key, required this.args});

  final EscribirResenaArgs args;

  @override
  ConsumerState<EscribirResenaPantalla> createState() => _EscribirResenaPantallaState();
}

class _EscribirResenaPantallaState extends ConsumerState<EscribirResenaPantalla> {
  late final TextEditingController _titulo;
  late final TextEditingController _texto;
  int _calificacion = 0;
  DateTime? _fecha;
  bool _enviando = false;
  String? _error;
  Map<String, String> _campos = const {};

  ResenaPropia? get _existente => widget.args.existente;
  bool get _edita => _existente != null;

  @override
  void initState() {
    super.initState();
    final e = _existente;
    _titulo = TextEditingController(text: e?.titulo ?? '');
    _texto = TextEditingController(text: e?.texto ?? '');
    _calificacion = e?.calificacion ?? 0;
    _fecha = e?.fechaVisita;
  }

  @override
  void dispose() {
    _titulo.dispose();
    _texto.dispose();
    super.dispose();
  }

  bool get _puedeEnviar => !_enviando && _calificacion > 0 && textoValido(_texto.text);

  Future<void> _elegirFecha() async {
    final hoy = DateTime.now();
    final f = await elegirFecha(
      context,
      inicial: _fecha ?? hoy,
      primera: DateTime(hoy.year - 3),
      ultima: hoy,
      ayuda: '¿Cuándo fuiste?',
    );
    if (f != null) setState(() => _fecha = f);
  }

  Future<void> _enviar() async {
    setState(() {
      _enviando = true;
      _error = null;
      _campos = const {};
    });
    final mensajes = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final mensaje = await ref.read(repositorioDetalleProvider).guardarResena(
            negocioId: widget.args.negocio.id,
            resenaId: _existente?.id,
            calificacion: _calificacion,
            titulo: _titulo.text,
            texto: _texto.text,
            fechaVisita: _fecha,
          );
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(mensaje)));
      router.pop(true);
    } catch (e) {
      final err = ErrorApi.desde(e);
      if (mounted) {
        setState(() {
          _enviando = false;
          _error = err.campos.isEmpty ? err.general : null;
          _campos = err.campos;
        });
      }
    }
  }

  Future<void> _confirmarBorrar() async {
    final seguro = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => ConfirmarBorrarResena(nombreNegocio: widget.args.negocio.nombre),
    );
    if (seguro != true || !mounted) return;
    setState(() => _enviando = true);
    final mensajes = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      await ref.read(repositorioDetalleProvider).borrarResena(_existente!.id);
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Eliminamos tu reseña.')));
      router.pop(true);
    } catch (e) {
      if (mounted) setState(() {
        _enviando = false;
        _error = ErrorApi.desde(e).general;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.args.negocio;
    final usuario = ref.watch(sesionProvider).valueOrNull;
    final sinVerificar = usuario != null && !usuario.correoVerificado;
    final hoy = DateTime.now();
    final meses = mesesRecientes(hoy);
    final otraFecha = _fecha != null && !meses.any((m) => mismoMes(_fecha, m) && _fecha!.day == 1);
    final largo = _texto.text.trim().length;

    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(icon: const Icon(Icons.close), onPressed: _enviando ? null : () => context.pop(false)),
        centerTitle: true,
        title: Text(_edita ? 'Editar reseña' : 'Tu reseña', style: titulo(18)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
            child: Row(
              children: [
                FotoNegocio(url: n.portadaUrl, nombre: n.nombre, radio: 14, alto: 56, ancho: 56, icono: iconoCategoria(n.categoriaClave)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(n.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(16)),
                      if ((n.subtitulo ?? '').isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(n.subtitulo!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (sinVerificar) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFBF3DF), borderRadius: BorderRadius.circular(14)),
              child: const Text('Confirma tu correo para publicar reseñas. Abre el enlace que te enviamos al registrarte.',
                  style: TextStyle(fontSize: 13.5, height: 1.35)),
            ),
          ],
          const SizedBox(height: 22),
          const Text('¿Cómo estuvo tu experiencia?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 1; i <= 5; i++)
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _enviando ? null : () => setState(() => _calificacion = i),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Icon(i <= _calificacion ? Icons.star_rounded : Icons.star_outline_rounded,
                        size: 44, color: i <= _calificacion ? Colores.maiz : const Color(0xFFD9CDB8)),
                  ),
                ),
              const Spacer(),
              Text(etiquetaCalificacion(_calificacion),
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: _calificacion > 0 ? Colores.grana : Colores.suave)),
            ],
          ),
          if (_campos['calificacion'] != null) _msg(_campos['calificacion']!),
          const SizedBox(height: 18),
          const Text('Título de tu reseña', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          TextField(
            controller: _titulo,
            maxLength: resenaTituloMaximo,
            textCapitalization: TextCapitalization.sentences,
            decoration: _decoracion('Ej. Terraza preciosa y desayuno rico (opcional)'),
          ),
          if (_campos['titulo'] != null) _msg(_campos['titulo']!),
          const SizedBox(height: 10),
          const Text('Cuéntanos más', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          TextField(
            controller: _texto,
            minLines: 5,
            maxLines: 9,
            maxLength: resenaTextoMaximo,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            decoration: _decoracion('¿Qué te gustó? ¿Qué mejorarías? Ayuda a quien viene después.').copyWith(counterText: ''),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(largo < resenaTextoMinimo ? 'Mínimo $resenaTextoMinimo caracteres' : '',
                    style: TextStyle(fontSize: 12, color: largo > 0 && largo < resenaTextoMinimo ? Colores.grana : Colores.suave)),
                Text('$largo / $resenaTextoMaximo', style: const TextStyle(fontSize: 12, color: Colores.suave)),
              ],
            ),
          ),
          if (_campos['texto'] != null) _msg(_campos['texto']!),
          const SizedBox(height: 14),
          const Text('¿Cuándo fuiste?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in meses)
                _ChipFecha(
                  texto: mesAnio(m),
                  activo: _fecha != null && mismoMes(_fecha, m) && _fecha!.day == 1,
                  alTocar: () => setState(() => _fecha = (_fecha != null && mismoMes(_fecha, m) && _fecha!.day == 1) ? null : m),
                ),
              _ChipFecha(
                texto: otraFecha ? fechaCorta(_fecha!) : 'Otra fecha',
                icono: Icons.calendar_today_outlined,
                activo: otraFecha,
                alTocar: _elegirFecha,
              ),
            ],
          ),
          if (_campos['fechaVisita'] != null) _msg(_campos['fechaVisita']!),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(color: Colores.cantera, borderRadius: BorderRadius.circular(14)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.lock_outline, size: 16, color: Colores.suave),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: const TextStyle(fontSize: 12.5, color: Colores.suave, height: 1.4),
                      children: [
                        const TextSpan(text: 'Tu reseña se publica con tu nombre y la inicial de tu apellido: '),
                        TextSpan(text: nombreCorto(usuario?.nombre ?? ''), style: const TextStyle(color: Colores.tinta, fontWeight: FontWeight.w800)),
                        const TextSpan(text: '. Si usa lenguaje que no permitimos, el equipo la revisa antes de mostrarla.'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(14)),
              child: Text(_error!, style: const TextStyle(color: Colores.grana, fontWeight: FontWeight.w600, height: 1.35)),
            ),
          ],
          if (_edita) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: _enviando ? null : _confirmarBorrar,
              icon: const Icon(Icons.delete_outline, size: 19),
              label: const Text('Eliminar mi reseña'),
              style: TextButton.styleFrom(foregroundColor: Colores.grana),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Colores.linea)),
          ),
          child: SizedBox(
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colores.grana,
                disabledBackgroundColor: const Color(0xFFE8DCC9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              onPressed: _puedeEnviar && !sinVerificar ? _enviar : null,
              child: _enviando
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : Text(_edita ? 'Guardar cambios' : 'Publicar reseña', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _msg(String t) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(t, style: const TextStyle(color: Colores.grana, fontSize: 12.5, fontWeight: FontWeight.w600)),
      );

  InputDecoration _decoracion(String pista) => InputDecoration(
        hintText: pista,
        hintStyle: const TextStyle(color: Colores.suave, fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.linea, width: 1.5)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Colores.grana, width: 1.5)),
      );
}

class _ChipFecha extends StatelessWidget {
  const _ChipFecha({required this.texto, required this.activo, required this.alTocar, this.icono});

  final String texto;
  final bool activo;
  final VoidCallback alTocar;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: activo ? Colores.tinta : Colors.white,
      shape: StadiumBorder(side: BorderSide(color: activo ? Colores.tinta : Colores.linea, width: 1.5)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: alTocar,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icono != null) ...[Icon(icono, size: 15, color: activo ? Colors.white : Colores.tinta), const SizedBox(width: 6)],
              Text(texto, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: activo ? Colors.white : Colores.tinta)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Hoja de confirmación para eliminar una reseña. Responde `true` si la persona confirma.
class ConfirmarBorrarResena extends StatelessWidget {
  const ConfirmarBorrarResena({super.key, required this.nombreNegocio});

  final String nombreNegocio;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 18),
            const Icon(Icons.delete_outline, size: 34, color: Colores.grana),
            const SizedBox(height: 8),
            Text('¿Eliminar tu reseña?', style: titulo(21)),
            const SizedBox(height: 8),
            Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 14, height: 1.45, color: Colores.suave),
                children: [
                  const TextSpan(text: 'Se quitará de la ficha de '),
                  TextSpan(text: nombreNegocio, style: const TextStyle(color: Colores.tinta, fontWeight: FontWeight.w800)),
                  const TextSpan(text: ' y puede cambiar su calificación promedio. No se puede deshacer.'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Colores.grana, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Sí, eliminar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colores.tinta,
                  side: const BorderSide(color: Colores.linea, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                ),
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Mejor no', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
