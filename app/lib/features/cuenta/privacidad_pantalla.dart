import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/respuesta.dart';
import '../../core/config.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart' show EstadoVacio;
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

/// Abre el texto legal en el navegador (la dirección se pasa al compilar; ver Config).
Future<void> abrirTextoLegal(BuildContext context, String url) async {
  if (url.isEmpty) {
    avisar(context, 'El texto completo estará disponible cuando publiquemos el sitio.');
    return;
  }
  var ok = false;
  try {
    ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } catch (_) {}
  if (!ok && context.mounted) avisar(context, 'No pudimos abrir la página.');
}

/// Perfil → Mis datos y privacidad.
class PrivacidadPantalla extends ConsumerStatefulWidget {
  const PrivacidadPantalla({super.key});

  @override
  ConsumerState<PrivacidadPantalla> createState() => _PrivacidadPantallaState();
}

class _PrivacidadPantallaState extends ConsumerState<PrivacidadPantalla> {
  final Map<String, bool> _pref = {};

  Future<void> _cambiar(String tipo, bool valor) async {
    final antes = _pref[tipo];
    setState(() => _pref[tipo] = valor);
    try {
      await ref.read(repositorioCuentaProvider).registrarConsentimiento(tipo, valor);
      ref.invalidate(consentimientosProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() => antes == null ? _pref.remove(tipo) : _pref[tipo] = antes);
      avisar(context, ErrorApi.desde(e).general);
    }
  }

  Future<void> _solicitar(String tipo) async {
    final enviada = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => _HojaSolicitud(tipo: tipo),
    );
    if (enviada == true) ref.invalidate(solicitudesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final cons = ref.watch(consentimientosProvider);
    final sols = ref.watch(solicitudesProvider);
    if (cons.hasError && !cons.hasValue) {
      return PantallaCuenta(
        titulo: 'Mis datos y privacidad',
        hijos: [
          SizedBox(
            height: 380,
            child: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: ErrorApi.desde(cons.error!).general, accion: () => ref.invalidate(consentimientosProvider)),
          ),
        ],
      );
    }
    final ultimos = ultimoPorTipo(cons.valueOrNull ?? const []);
    final solicitudes = sols.valueOrNull ?? const <SolicitudPrivacidad>[];

    bool valor(String tipo) => _pref[tipo] ?? ultimos[tipo]?.aceptado ?? false;

    String? aceptado(String tipo) {
      final c = ultimos[tipo];
      if (c == null || !c.aceptado) return 'Sin registro';
      return 'Aceptado · versión ${c.versionTexto}${c.fecha == null ? '' : ' · ${fechaLarga(c.fecha!)}'}';
    }

    SolicitudPrivacidad? ultima(String tipo) {
      final l = solicitudes.where((s) => s.tipo == tipo).toList()..sort((a, b) => (b.creadoEn ?? DateTime(0)).compareTo(a.creadoEn ?? DateTime(0)));
      return l.isEmpty ? null : l.first;
    }

    String detalleDerecho(String tipo) {
      final s = ultima(tipo);
      if (s == null) return switch (tipo) {
        'acceso' => 'Solicitar acceso',
        'rectificacion' => 'Solicitar rectificación',
        'cancelacion' => 'Solicitar cancelación',
        _ => 'Solicitar oposición',
      };
      return 'Tu solicitud: ${estadoSolicitud(s.estado)}${s.creadoEn == null ? '' : ' · ${fechaLarga(s.creadoEn!)}'}';
    }

    Widget interruptor(String tipo) => Switch.adaptive(
          value: valor(tipo),
          activeTrackColor: Colores.ok,
          activeColor: Colors.white,
          onChanged: (v) => _cambiar(tipo, v),
        );

    return PantallaCuenta(
      titulo: 'Mis datos y privacidad',
      alRefrescar: () async {
        ref.invalidate(solicitudesProvider);
        await ref.refresh(consentimientosProvider.future);
      },
      hijos: [
        const TituloGrupo('Tus preferencias'),
        GrupoFilas(
          filas: [
            FilaAjuste(icono: Icons.insights_outlined, titulo: 'Mejorar la app con estadísticas', detalle: 'Datos de uso anónimos', final_: interruptor('analitica')),
            FilaAjuste(icono: Icons.mark_email_unread_outlined, titulo: 'Novedades y promociones', detalle: 'Avisos de Travel Oaxaca por correo', final_: interruptor('marketing')),
          ],
        ),
        const TituloGrupo('Lo que aceptaste'),
        GrupoFilas(
          filas: [
            FilaAjuste(
              icono: Icons.description_outlined,
              titulo: 'Términos de uso',
              detalle: aceptado('terminos'),
              alTocar: () => abrirTextoLegal(context, Config.urlTerminos),
            ),
            FilaAjuste(
              icono: Icons.lock_outline,
              titulo: 'Aviso de privacidad',
              detalle: aceptado('privacidad'),
              alTocar: () => abrirTextoLegal(context, Config.urlPrivacidad),
            ),
          ],
        ),
        const TituloGrupo('Tus derechos sobre tus datos'),
        GrupoFilas(
          filas: [
            for (final t in const ['acceso', 'rectificacion', 'cancelacion', 'oposicion'])
              FilaAjuste(
                icono: switch (t) {
                  'acceso' => Icons.visibility_outlined,
                  'rectificacion' => Icons.edit_outlined,
                  'cancelacion' => Icons.delete_outline,
                  _ => Icons.front_hand_outlined,
                },
                titulo: nombreDerecho(t),
                detalle: detalleDerecho(t),
                colorTitulo: t == 'cancelacion' ? Colores.grana : null,
                alTocar: () => _solicitar(t),
              ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 12, left: 4),
          child: Text('Respondemos tu solicitud por correo. Puedes ver su estado aquí mismo.', style: TextStyle(fontSize: 12, color: Colores.suave, height: 1.4)),
        ),
      ],
    );
  }
}

class _HojaSolicitud extends ConsumerStatefulWidget {
  const _HojaSolicitud({required this.tipo});
  final String tipo;

  @override
  ConsumerState<_HojaSolicitud> createState() => _HojaSolicitudState();
}

class _HojaSolicitudState extends ConsumerState<_HojaSolicitud> {
  final _detalle = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _detalle.dispose();
    super.dispose();
  }

  String get _explicacion => switch (widget.tipo) {
        'acceso' => 'Te enviaremos por correo una copia de los datos personales que tenemos de ti.',
        'rectificacion' => 'Dinos qué dato está mal y cómo debe quedar.',
        'cancelacion' => 'Se borrará tu cuenta y tus datos personales. Esto no se puede deshacer.',
        _ => 'Dinos para qué uso de tus datos quieres limitar o negar tu consentimiento.',
      };

  Future<void> _enviar() async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    final mensajes = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    try {
      final m = await ref.read(repositorioCuentaProvider).crearSolicitud(widget.tipo, _detalle.text);
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(m)));
      nav.pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _enviando = false;
          _error = ErrorApi.desde(e).general;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cancelar = widget.tipo == 'cancelacion';
    return Padding(
      padding: EdgeInsets.fromLTRB(22, 12, 22, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 18),
            Text(nombreDerecho(widget.tipo), style: titulo(21)),
            const SizedBox(height: 8),
            Text(_explicacion, style: const TextStyle(fontSize: 14, height: 1.45, color: Colores.suave)),
            const SizedBox(height: 14),
            TextField(
              controller: _detalle,
              minLines: 3,
              maxLines: 5,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: decoracionCampo('Detalle (opcional)').copyWith(counterText: ''),
            ),
            if (_error != null) AvisoCampo(_error!),
            const SizedBox(height: 16),
            SizedBox(
              height: 52,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: cancelar ? Colores.grana : Colores.tinta, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                onPressed: _enviando ? null : _enviar,
                child: _enviando
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : Text(cancelar ? 'Solicitar borrar mi cuenta' : 'Enviar solicitud', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
