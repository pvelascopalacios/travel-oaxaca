import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/config.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../cuenta/privacidad_pantalla.dart' show abrirTextoLegal;
import '../cuenta/repositorio.dart';
import '../cuenta/widgets.dart';
import '../detalle/repositorio.dart';
import 'invitar_a_ingresar.dart';

class PerfilPantalla extends ConsumerStatefulWidget {
  const PerfilPantalla({super.key});

  @override
  ConsumerState<PerfilPantalla> createState() => _PerfilPantallaState();
}

class _PerfilPantallaState extends ConsumerState<PerfilPantalla> {
  bool _reenviando = false;

  @override
  void initState() {
    super.initState();
    // Si confirmó el correo desde otro lado, que se note al abrir el perfil.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(sesionProvider.notifier).refrescarPerfil();
    });
  }

  Future<void> _reenviar(String correo) async {
    setState(() => _reenviando = true);
    try {
      final m = await ref.read(repositorioCuentaProvider).reenviarVerificacion(correo);
      if (mounted) avisar(context, m);
    } catch (e) {
      if (mounted) avisar(context, ErrorApi.desde(e).general);
    } finally {
      if (mounted) setState(() => _reenviando = false);
    }
  }

  void _textosLegales() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colores.linea, borderRadius: BorderRadius.circular(4))),
              const SizedBox(height: 10),
              FilaAjuste(
                icono: Icons.description_outlined,
                titulo: 'Términos de uso',
                alTocar: () {
                  Navigator.pop(ctx);
                  abrirTextoLegal(context, Config.urlTerminos);
                },
              ),
              FilaAjuste(
                icono: Icons.lock_outline,
                titulo: 'Aviso de privacidad',
                alTocar: () {
                  Navigator.pop(ctx);
                  abrirTextoLegal(context, Config.urlPrivacidad);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionProvider);
    final usuario = sesion.valueOrNull;
    if (sesion.isLoading && usuario == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (usuario == null) {
      return const InvitarAIngresar(
        titulo: 'Tu perfil',
        texto: 'Crea tu cuenta o ingresa para guardar favoritos y dejar reseñas.',
        icono: Icons.person_outline,
      );
    }
    final nResenas = ref.watch(misResenasProvider).valueOrNull?.length;
    final nFavoritos = ref.watch(favoritosProvider).valueOrNull?.length;
    final nSesiones = ref.watch(sesionesProvider).valueOrNull?.length;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () async {
          await ref.read(sesionProvider.notifier).refrescarPerfil();
          ref.invalidate(misResenasProvider);
          ref.invalidate(sesionesProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 34,
                  backgroundColor: const Color(0xFFFBE8EE),
                  child: Text(usuario.inicial, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colores.grana)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(usuario.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(22)),
                      const SizedBox(height: 2),
                      Text(usuario.correo, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colores.suave, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
            if (!usuario.correoVerificado) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                decoration: BoxDecoration(color: const Color(0xFFFBF3DF), borderRadius: BorderRadius.circular(18)),
                child: Row(
                  children: [
                    const Icon(Icons.mark_email_unread_outlined, color: Color(0xFF8A6100)),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Confirma tu correo', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                          Text('Lo necesitas para escribir reseñas. Si ya lo confirmaste, desliza hacia abajo para actualizar.',
                              style: TextStyle(fontSize: 12, color: Colores.suave, height: 1.3)),
                        ],
                      ),
                    ),
                    _reenviando
                        ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                        : TextButton(
                            onPressed: () => _reenviar(usuario.correo),
                            style: TextButton.styleFrom(foregroundColor: Colores.grana),
                            child: const Text('Reenviar', style: TextStyle(fontWeight: FontWeight.w800)),
                          ),
                  ],
                ),
              ),
            ],
            const TituloGrupo('Mi actividad'),
            GrupoFilas(filas: [
              FilaAjuste(
                icono: Icons.star_outline_rounded,
                titulo: 'Mis reseñas',
                detalle: nResenas == null ? null : (nResenas == 1 ? '1 escrita' : '$nResenas escritas'),
                alTocar: () => context.push('/mis-resenas'),
              ),
              FilaAjuste(
                icono: Icons.calendar_month_outlined,
                titulo: 'Mis listas e itinerarios',
                alTocar: () => context.push('/listas'),
              ),
              FilaAjuste(
                icono: Icons.favorite_border,
                titulo: 'Favoritos',
                detalle: nFavoritos == null ? null : (nFavoritos == 1 ? '1 guardado' : '$nFavoritos guardados'),
                alTocar: () => context.go('/favoritos'),
              ),
            ]),
            const TituloGrupo('Cuenta'),
            GrupoFilas(filas: [
              FilaAjuste(icono: Icons.person_outline, titulo: 'Datos personales', detalle: 'Nombre, teléfono e idioma', alTocar: () => context.push('/cuenta/datos')),
              FilaAjuste(icono: Icons.key_outlined, titulo: 'Contraseña', alTocar: () => context.push('/cuenta/clave')),
              FilaAjuste(
                icono: Icons.shield_outlined,
                titulo: 'Sesiones abiertas',
                detalle: nSesiones == null ? null : (nSesiones == 1 ? '1 dispositivo' : '$nSesiones dispositivos'),
                alTocar: () => context.push('/cuenta/sesiones'),
              ),
            ]),
            const TituloGrupo('Privacidad y ayuda'),
            GrupoFilas(filas: [
              FilaAjuste(icono: Icons.lock_outline, titulo: 'Mis datos y consentimientos', alTocar: () => context.push('/cuenta/privacidad')),
              FilaAjuste(icono: Icons.description_outlined, titulo: 'Términos y aviso de privacidad', alTocar: _textosLegales),
            ]),
            const SizedBox(height: 18),
            Center(
              child: TextButton(
                onPressed: () => ref.read(sesionProvider.notifier).salir(),
                style: TextButton.styleFrom(foregroundColor: Colores.grana),
                child: const Text('Cerrar sesión', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
            const Center(child: Text('Travel Oaxaca · versión 1.0.0', style: TextStyle(color: Colores.suave, fontSize: 12))),
          ],
        ),
      ),
    );
  }
}
