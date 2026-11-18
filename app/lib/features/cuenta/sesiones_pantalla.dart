import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/respuesta.dart';
import '../../core/adaptativo.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart' show EstadoVacio;
import 'modelos.dart';
import 'repositorio.dart';
import 'utiles.dart';
import 'widgets.dart';

/// Perfil → Sesiones abiertas: dónde está abierta mi cuenta y cerrar las que no reconozco.
class SesionesPantalla extends ConsumerStatefulWidget {
  const SesionesPantalla({super.key});

  @override
  ConsumerState<SesionesPantalla> createState() => _SesionesPantallaState();
}

class _SesionesPantallaState extends ConsumerState<SesionesPantalla> {
  final Set<String> _cerrando = {};
  bool _cerrandoTodas = false;

  Future<void> _cerrar(SesionActiva s) async {
    setState(() => _cerrando.add(s.id));
    try {
      await ref.read(repositorioCuentaProvider).cerrarSesion(s.id);
      ref.invalidate(sesionesProvider);
    } catch (e) {
      if (mounted) avisar(context, ErrorApi.desde(e).general);
    } finally {
      if (mounted) setState(() => _cerrando.remove(s.id));
    }
  }

  Future<void> _cerrarOtras(List<SesionActiva> otras) async {
    final seguro = await confirmar(
      context,
      titulo: '¿Cerrar las demás sesiones?',
      texto: 'Se cerrará tu cuenta en ${otras.length} ${otras.length == 1 ? 'dispositivo' : 'dispositivos'}. En este seguirás dentro.',
      si: 'Sí, cerrar',
      no: 'Mejor no',
      peligro: true,
    );
    if (!seguro || !mounted) return;
    setState(() => _cerrandoTodas = true);
    var fallaron = 0;
    for (final s in otras) {
      try {
        await ref.read(repositorioCuentaProvider).cerrarSesion(s.id);
      } catch (_) {
        fallaron++;
      }
    }
    ref.invalidate(sesionesProvider);
    if (mounted) {
      setState(() => _cerrandoTodas = false);
      avisar(context, fallaron == 0 ? 'Cerramos las demás sesiones.' : 'No pudimos cerrar $fallaron. Inténtalo de nuevo.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(sesionesProvider);
    return datos.when(
      loading: () => const PantallaCuenta(titulo: 'Sesiones abiertas', hijos: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (e, _) => PantallaCuenta(
        titulo: 'Sesiones abiertas',
        hijos: [SizedBox(height: 380, child: EstadoVacio(icono: Icons.cloud_off, titulo: 'No pudimos cargar', texto: ErrorApi.desde(e).general, accion: () => ref.invalidate(sesionesProvider)))],
      ),
      data: (lista) {
        final ahora = DateTime.now();
        final otras = lista.where((s) => !s.actual).toList();
        final ordenadas = [...lista]..sort((a, b) => a.actual ? -1 : (b.actual ? 1 : (b.creadoEn ?? ahora).compareTo(a.creadoEn ?? ahora)));
        return PantallaCuenta(
          titulo: 'Sesiones abiertas',
          alRefrescar: () async => ref.refresh(sesionesProvider.future),
          hijos: [
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text('Estos son los dispositivos donde tu cuenta está abierta. Cierra los que no reconozcas.',
                  style: TextStyle(fontSize: 13, color: Colores.suave, height: 1.4)),
            ),
            GrupoFilas(
              filas: [
                for (final s in ordenadas)
                  FilaAjuste(
                    icono: s.plataforma == 'web' ? Icons.laptop_outlined : Icons.smartphone_outlined,
                    titulo: tituloSesion(s),
                    detalle: s.creadoEn == null ? null : 'Abierta ${textoAbierta(s.creadoEn!, ahora)}',
                    final_: s.actual
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: Colores.okFondo, borderRadius: BorderRadius.circular(999)),
                            child: const Text('Este dispositivo', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colores.ok)),
                          )
                        : (_cerrando.contains(s.id)
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                            : TextButton(
                                onPressed: _cerrandoTodas ? null : () => _cerrar(s),
                                style: TextButton.styleFrom(foregroundColor: Colores.grana),
                                child: const Text('Cerrar', style: TextStyle(fontWeight: FontWeight.w800)),
                              )),
                  ),
              ],
            ),
            if (otras.isNotEmpty) ...[
              const SizedBox(height: 16),
              SizedBox(
                height: 52,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colores.grana,
                    side: const BorderSide(color: Colores.grana, width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                  ),
                  onPressed: _cerrandoTodas ? null : () => _cerrarOtras(otras),
                  child: _cerrandoTodas
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
                      : const Text('Cerrar sesión en los demás dispositivos', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Center(child: Text('Cerrará todas menos esta.', style: TextStyle(fontSize: 12, color: Colores.suave))),
              ),
            ] else
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Center(child: Text('Solo este dispositivo tiene tu cuenta abierta.', style: TextStyle(fontSize: 13, color: Colores.suave))),
              ),
          ],
        );
      },
    );
  }
}
