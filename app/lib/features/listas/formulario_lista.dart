import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/respuesta.dart';
import '../../core/adaptativo.dart';
import '../../core/tema.dart';
import '../cuenta/widgets.dart' show BotonGrana, EtiquetaCampo, decoracionCampo;
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';

/// Hoja para crear o editar una lista o itinerario. Devuelve la lista guardada, o null si se cerró.
Future<ListaResumen?> mostrarFormularioLista(BuildContext context, {ListaResumen? existente, bool itinerarioInicial = false}) {
  return showModalBottomSheet<ListaResumen>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colores.crema,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
    builder: (_) => FormularioLista(existente: existente, itinerarioInicial: itinerarioInicial),
  );
}

/// Valida las fechas de un itinerario. Devuelve el mensaje de error o null si están bien.
String? validarFechas(DateTime? inicio, DateTime? fin) {
  if (inicio != null && fin != null && fin.isBefore(inicio)) return 'La fecha final no puede ser antes de la inicial.';
  if ((inicio == null) != (fin == null)) return 'Pon las dos fechas, o deja las dos vacías.';
  return null;
}

class FormularioLista extends ConsumerStatefulWidget {
  const FormularioLista({super.key, this.existente, this.itinerarioInicial = false});
  final ListaResumen? existente;
  final bool itinerarioInicial;

  @override
  ConsumerState<FormularioLista> createState() => _FormularioListaState();
}

class _FormularioListaState extends ConsumerState<FormularioLista> {
  late final TextEditingController _nombre;
  late bool _esItinerario;
  DateTime? _inicio;
  DateTime? _fin;
  late bool _publica;
  bool _enviando = false;
  String? _errorNombre;
  String? _errorFechas;
  String? _errorGeneral;

  bool get _edita => widget.existente != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existente;
    _nombre = TextEditingController(text: e?.nombre ?? '');
    _esItinerario = e?.esItinerario ?? widget.itinerarioInicial;
    _inicio = e?.fechaInicio;
    _fin = e?.fechaFin;
    _publica = e?.publica ?? false;
  }

  @override
  void dispose() {
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha(bool inicio) async {
    final ahora = DateTime.now();
    final base = (inicio ? _inicio : _fin) ?? _inicio ?? ahora;
    final f = await elegirFecha(
      context,
      inicial: base,
      primera: DateTime(ahora.year - 1),
      ultima: DateTime(ahora.year + 5),
      ayuda: inicio ? 'Fecha de inicio' : 'Fecha final',
    );
    if (f == null) return;
    setState(() {
      if (inicio) {
        _inicio = f;
        if (_fin == null || _fin!.isBefore(f)) _fin = f;
      } else {
        _fin = f;
        _inicio ??= f;
      }
      _errorFechas = null;
    });
  }

  Future<void> _guardar() async {
    final nombre = _nombre.text.trim();
    String? eNombre;
    if (nombre.isEmpty) {
      eNombre = 'Ponle un nombre.';
    } else if (nombre.length > 80) {
      eNombre = 'Máximo 80 caracteres.';
    }
    final eFechas = _esItinerario ? validarFechas(_inicio, _fin) : null;
    if (eNombre != null || eFechas != null) {
      setState(() {
        _errorNombre = eNombre;
        _errorFechas = eFechas;
      });
      return;
    }
    setState(() {
      _enviando = true;
      _errorGeneral = null;
    });
    try {
      final repo = ref.read(repositorioListasProvider);
      final r = _edita
          ? await repo.actualizar(widget.existente!.id, nombre: nombre, esItinerario: _esItinerario, inicio: _inicio, fin: _fin, publica: _publica)
          : await repo.crear(nombre: nombre, esItinerario: _esItinerario, inicio: _inicio, fin: _fin, publica: _publica);
      ref.invalidate(misListasProvider);
      if (_edita) ref.invalidate(listaDetalleProvider(widget.existente!.id));
      if (mounted) Navigator.of(context).pop(r);
    } catch (e) {
      final err = ErrorApi.desde(e);
      if (mounted) {
        setState(() {
          _enviando = false;
          _errorNombre = err.campos['nombre'];
          _errorFechas = err.campos['fechaFin'] ?? err.campos['fechaInicio'];
          _errorGeneral = (_errorNombre == null && _errorFechas == null) ? err.general : null;
        });
      }
    }
  }

  Widget _selector(String texto, DateTime? valor, VoidCallback alTocar) => Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: _enviando ? null : alTocar,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colores.linea, width: 1.5)),
            child: Row(
              children: [
                const Icon(Icons.event, size: 18, color: Colores.suave),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    valor == null ? texto : textoFechas(valor, valor),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: valor == null ? Colores.suave : Colores.tinta),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final teclado = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: teclado),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 14),
            Text(_edita ? 'Editar' : 'Nueva lista o itinerario', style: titulo(21)),
            const EtiquetaCampo('Nombre'),
            TextField(
              controller: _nombre,
              enabled: !_enviando,
              maxLength: 80,
              textCapitalization: TextCapitalization.sentences,
              decoration: decoracionCampo('Ej. Fin de semana en Oaxaca', error: _errorNombre).copyWith(counterText: ''),
              onChanged: (_) {
                if (_errorNombre != null) setState(() => _errorNombre = null);
              },
            ),
            const SizedBox(height: 14),
            _Interruptor(
              titulo: 'Es un itinerario',
              texto: _edita ? 'No se puede cambiar después de crearlo.' : 'Organiza lugares por día de tu viaje.',
              valor: _esItinerario,
              alCambiar: _edita || _enviando ? null : (v) => setState(() => _esItinerario = v),
            ),
            if (_esItinerario) ...[
              const EtiquetaCampo('Fechas del viaje', nota: 'opcional'),
              Row(
                children: [
                  _selector('Inicio', _inicio, () => _elegirFecha(true)),
                  const SizedBox(width: 10),
                  _selector('Fin', _fin, () => _elegirFecha(false)),
                ],
              ),
              if (_errorFechas != null)
                Padding(padding: const EdgeInsets.only(top: 6, left: 4), child: Text(_errorFechas!, style: const TextStyle(color: Colores.grana, fontSize: 12.5))),
              if (_inicio != null || _fin != null)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: _enviando ? null : () => setState(() {
                      _inicio = null;
                      _fin = null;
                      _errorFechas = null;
                    }),
                    child: const Text('Quitar fechas'),
                  ),
                ),
            ],
            const SizedBox(height: 8),
            _Interruptor(
              titulo: 'Pública',
              texto: 'Cualquiera con el enlace podrá verla.',
              valor: _publica,
              alCambiar: _enviando ? null : (v) => setState(() => _publica = v),
            ),
            if (_errorGeneral != null)
              Padding(padding: const EdgeInsets.only(top: 10), child: Text(_errorGeneral!, style: const TextStyle(color: Colores.grana, fontSize: 13))),
            const SizedBox(height: 18),
            SizedBox(height: 52, width: double.infinity, child: BotonGrana(texto: _edita ? 'Guardar cambios' : 'Crear', enviando: _enviando, alTocar: _guardar)),
          ],
        ),
      ),
    );
  }
}

class _Interruptor extends StatelessWidget {
  const _Interruptor({required this.titulo, required this.texto, required this.valor, required this.alCambiar});
  final String titulo;
  final String texto;
  final bool valor;
  final ValueChanged<bool>? alCambiar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colores.linea)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titulo, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                const SizedBox(height: 2),
                Text(texto, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
              ],
            ),
          ),
          Switch.adaptive(value: valor, onChanged: alCambiar, activeColor: Colores.grana),
        ],
      ),
    );
  }
}
