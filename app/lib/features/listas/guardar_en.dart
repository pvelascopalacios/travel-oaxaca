import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../cuenta/widgets.dart' show BotonGrana;
import 'formulario_lista.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';

/// Abre "Guardar en…" para un negocio, lugar o ruta. Sin cuenta, lleva a ingresar.
Future<void> mostrarGuardarEn(BuildContext context, WidgetRef ref, {required String tipo, required String id, required String nombre}) async {
  if (ref.read(sesionProvider).valueOrNull == null) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Ingresa para guardar en tus listas.')));
    context.push('/ingresar');
    return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colores.crema,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
    builder: (_) => GuardarEn(tipo: tipo, id: id, nombre: nombre),
  );
}

/// Botón redondo con un marcador, para junto al corazón.
class BotonGuardarEn extends ConsumerWidget {
  const BotonGuardarEn({super.key, required this.tipo, required this.id, required this.nombre, this.tam = 42});
  final String tipo;
  final String id;
  final String nombre;
  final double tam;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => mostrarGuardarEn(context, ref, tipo: tipo, id: id, nombre: nombre),
      child: Container(
        width: tam,
        height: tam,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          shape: BoxShape.circle,
          boxShadow: const [BoxShadow(color: Color(0x26000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Icon(Icons.bookmark_add_outlined, size: tam * 0.52, color: Colores.tinta),
      ),
    );
  }
}

class GuardarEn extends ConsumerStatefulWidget {
  const GuardarEn({super.key, required this.tipo, required this.id, required this.nombre});
  final String tipo;
  final String id;
  final String nombre;

  @override
  ConsumerState<GuardarEn> createState() => _GuardarEnState();
}

class _GuardarEnState extends ConsumerState<GuardarEn> {
  String? _listaId;
  int _dia = 1;
  bool _enviando = false;
  String? _error;

  Future<void> _nueva() async {
    final r = await mostrarFormularioLista(context);
    if (r != null && mounted) {
      setState(() {
        _listaId = r.id;
        _dia = 1;
      });
    }
  }

  Future<void> _guardar(List<ListaResumen> listas) async {
    final lista = listas.where((l) => l.id == _listaId).firstOrNull;
    if (lista == null) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref.read(repositorioListasProvider).agregar(lista.id, tipo: widget.tipo, id: widget.id, dia: lista.esItinerario ? _dia : null);
      ref.invalidate(misListasProvider);
      ref.invalidate(listaDetalleProvider(lista.id));
      if (!mounted) return;
      final mensajes = ScaffoldMessenger.of(context);
      final destino = lista.esItinerario ? '${lista.nombre} (día $_dia)' : lista.nombre;
      Navigator.of(context).pop();
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('Guardado en $destino')));
    } catch (e) {
      final err = ErrorApi.desde(e);
      if (mounted) {
        setState(() {
          _enviando = false;
          _error = err.codigo == 409 ? 'Ese elemento ya está en la lista.' : err.general;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final listas = ref.watch(misListasProvider);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 14),
            Text('Guardar en…', style: titulo(21)),
            const SizedBox(height: 4),
            Text(widget.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colores.suave, fontSize: 13.5)),
            const SizedBox(height: 12),
            Flexible(
              child: listas.when(
                loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Column(
                    children: [
                      Text(ErrorApi.desde(e).general, textAlign: TextAlign.center, style: const TextStyle(color: Colores.suave)),
                      TextButton(onPressed: () => ref.invalidate(misListasProvider), child: const Text('Reintentar')),
                    ],
                  ),
                ),
                data: (datos) => ListView(
                  shrinkWrap: true,
                  children: [
                    if (datos.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 14),
                        child: Text('Aún no tienes listas ni itinerarios. Crea el primero.', style: TextStyle(color: Colores.suave, height: 1.4)),
                      ),
                    for (final l in datos) _fila(l),
                    const SizedBox(height: 6),
                    OutlinedButton.icon(
                      onPressed: _enviando ? null : _nueva,
                      icon: const Icon(Icons.add),
                      label: const Text('Nueva lista o itinerario'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colores.tinta,
                        minimumSize: const Size.fromHeight(48),
                        side: const BorderSide(color: Colores.linea, width: 1.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null)
              Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Colores.grana, fontSize: 13))),
            const SizedBox(height: 14),
            SizedBox(
              height: 52,
              width: double.infinity,
              child: BotonGrana(
                texto: 'Guardar',
                enviando: _enviando,
                alTocar: _listaId == null || !(listas.hasValue) ? null : () => _guardar(listas.value!),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fila(ListaResumen l) {
    final activa = _listaId == l.id;
    final conFechas = l.fechaInicio != null && l.fechaFin != null;
    final dias = diasDeItinerario(l.fechaInicio, l.fechaFin, const []) + (conFechas ? 0 : 1);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: activa ? Colores.avisoFondo : Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: _enviando
              ? null
              : () => setState(() {
                    _listaId = l.id;
                    _dia = 1;
                    _error = null;
                  }),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: activa ? Colores.grana : Colores.linea, width: activa ? 1.8 : 1)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(l.esItinerario ? Icons.calendar_month_outlined : Icons.bookmark_border, color: activa ? Colores.grana : Colores.suave),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                          Text('${l.esItinerario ? 'Itinerario' : 'Lista'} · ${textoElementos(l.totalElementos)}', style: const TextStyle(color: Colores.suave, fontSize: 12.5)),
                        ],
                      ),
                    ),
                    if (activa) const Icon(Icons.check_circle, color: Colores.grana),
                  ],
                ),
                if (activa && l.esItinerario) ...[
                  const SizedBox(height: 10),
                  const Text('¿Qué día?', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colores.suave)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      for (var d = 1; d <= dias; d++)
                        ChoiceChip(
                          label: Text('Día $d'),
                          selected: _dia == d,
                          onSelected: (_) => setState(() => _dia = d),
                          selectedColor: Colores.tinta,
                          labelStyle: TextStyle(color: _dia == d ? Colors.white : Colores.tinta, fontWeight: FontWeight.w700),
                          showCheckmark: false,
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
