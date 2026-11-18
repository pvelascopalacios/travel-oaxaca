import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/enlaces.dart';
import '../../core/tema.dart';
import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../explorar/widgets.dart';
import '../listas/guardar_en.dart';
import '../resenas/escribir_resena_pantalla.dart';
import 'modelos.dart';
import 'repositorio.dart';
import 'widgets.dart';

class FichaNegocioPantalla extends ConsumerWidget {
  const FichaNegocioPantalla({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(negocioProvider(slug));
    return datos.when(
      loading: () => const PantallaCargando(),
      error: (e, _) => PantallaError(error: e, reintentar: () => ref.invalidate(negocioProvider(slug))),
      data: (n) => _Ficha(negocio: n),
    );
  }
}

class _Ficha extends ConsumerStatefulWidget {
  const _Ficha({required this.negocio});
  final NegocioDetalle negocio;

  @override
  ConsumerState<_Ficha> createState() => _FichaState();
}

class _FichaState extends ConsumerState<_Ficha> {
  bool _descripcionCompleta = false;
  bool _horarioAbierto = false;

  static const _dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  static const _ordenDias = [1, 2, 3, 4, 5, 6, 0];

  NegocioDetalle get n => widget.negocio;

  String _textoHorario(int dia) {
    final s = n.principal;
    if (s == null) return 'Cerrado';
    final filas = s.horarios.where((h) => h.dia == dia).toList();
    if (filas.isEmpty || filas.every((h) => h.cerrado)) return 'Cerrado';
    return filas.where((h) => !h.cerrado).map((h) => '${h.abre ?? ''} – ${h.cierra ?? ''}').join(', ');
  }

  String _tituloOferta(String tipo) {
    final t = tipo.toLowerCase();
    if (t.contains('habit')) return 'Habitaciones';
    if (t.contains('tour')) return 'Tours';
    if (t.contains('plat') || t.contains('menu')) return 'Menú';
    if (t.contains('prod')) return 'Productos';
    if (t.contains('exper')) return 'Experiencias';
    return 'Opciones';
  }

  @override
  Widget build(BuildContext context) {
    final s = n.principal;
    final wa = n.contacto('whatsapp');
    final tel = n.contacto('telefono');
    final hoy = DateTime.now().weekday % 7; // 0 domingo
    final cierra = n.cierraHoy(hoy);
    final textoDesc = (n.descripcion != null && n.descripcion!.trim().isNotEmpty) ? n.descripcion!.trim() : (n.descripcionCorta ?? '');
    final hayHorario = s != null && s.horarios.isNotEmpty;
    final porTipo = <String, List<Oferta>>{};
    for (final o in n.ofertas) {
      porTipo.putIfAbsent(o.tipo, () => []).add(o);
    }
    final hayBarra = wa != null || tel != null || (s?.tieneCoordenadas ?? false);

    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                CabeceraFoto(
                  fotos: n.fotos,
                  nombre: n.nombre,
                  corazon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      BotonGuardarEn(tipo: 'negocio', id: n.id, nombre: n.nombre),
                      const SizedBox(width: 10),
                      BotonCorazon(
                        tipo: 'negocio',
                        id: n.id,
                        nombre: n.nombre,
                        slug: n.slug,
                        imagenUrl: n.fotos.isEmpty ? null : n.fotos.first.url,
                        tam: 42,
                      ),
                    ],
                  ),
                ),
                SliverToBoxAdapter(
                  child: Container(
                    color: Colores.crema,
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(child: Text(n.nombre, style: titulo(27))),
                            if (n.verificado) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.verified, size: 20, color: Colores.agave),
                            ],
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(n.subtitulo, style: const TextStyle(fontSize: 13.5, color: Colores.suave)),
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            DatoRapido(
                              grande: n.calificacion != null && n.totalResenas > 0 ? '★ ${n.calificacion!.toStringAsFixed(1)}' : 'Nuevo',
                              chico: n.totalResenas > 0 ? '${n.totalResenas} reseñas' : 'Sin reseñas aún',
                            ),
                            const SizedBox(width: 10),
                            DatoRapido(
                              grande: s?.abiertoAhora == null ? 'Horario' : (s!.abiertoAhora! ? 'Abierto' : 'Cerrado'),
                              chico: s?.abiertoAhora == null
                                  ? 'por confirmar'
                                  : (s!.abiertoAhora! && cierra != null ? 'hasta las $cierra' : 'ahora'),
                              color: s?.abiertoAhora == true ? Colores.ok : null,
                            ),
                            if (n.posicion != null && n.posicionTotal != null) ...[
                              const SizedBox(width: 10),
                              DatoRapido(
                                grande: 'N.º ${n.posicion}',
                                chico: 'de ${n.posicionTotal}${n.posicionMunicipio != null ? ' en ${n.posicionMunicipio}' : ''}',
                              ),
                            ],
                          ],
                        ),
                        for (final p in n.promociones) ...[
                          const SizedBox(height: 14),
                          _Promo(promo: p),
                        ],
                        if (textoDesc.isNotEmpty) ...[
                          const SizedBox(height: 18),
                          Text(
                            textoDesc,
                            maxLines: _descripcionCompleta ? null : 4,
                            overflow: _descripcionCompleta ? TextOverflow.visible : TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14.5, height: 1.5),
                          ),
                          if (textoDesc.length > 180)
                            GestureDetector(
                              onTap: () => setState(() => _descripcionCompleta = !_descripcionCompleta),
                              child: Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(_descripcionCompleta ? 'Leer menos' : 'Leer más',
                                    style: const TextStyle(color: Colores.grana, fontWeight: FontWeight.w700)),
                              ),
                            ),
                        ],
                        if (n.servicios.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final sv in n.servicios)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: Colores.linea, width: 1.5),
                                  ),
                                  child: Text(sv.nombre, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                ),
                            ],
                          ),
                        ],
                        if (n.idiomas.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text('Atienden en: ${n.idiomas.join(', ')}', style: const TextStyle(fontSize: 13, color: Colores.suave)),
                        ],
                        for (final entrada in porTipo.entries) ...[
                          const SizedBox(height: 24),
                          TituloSeccion(_tituloOferta(entrada.key)),
                          const SizedBox(height: 10),
                          for (final o in entrada.value) _FilaOferta(oferta: o),
                        ],
                        if (s != null && (s.tieneCoordenadas || (s.direccion ?? '').isNotEmpty)) ...[
                          const SizedBox(height: 24),
                          TituloSeccion(
                            'Ubicación',
                            accion: s.tieneCoordenadas ? 'Cómo llegar' : null,
                            alAccion: s.tieneCoordenadas ? () => Enlaces.comoLlegar(context, s.latitud!, s.longitud!) : null,
                          ),
                          const SizedBox(height: 10),
                          _TarjetaUbicacion(sucursal: s),
                        ],
                        if (hayHorario) ...[
                          const SizedBox(height: 24),
                          TituloSeccion(
                            'Horario',
                            accion: _horarioAbierto ? 'Ocultar' : 'Ver semana',
                            alAccion: () => setState(() => _horarioAbierto = !_horarioAbierto),
                          ),
                          const SizedBox(height: 10),
                          TarjetaBlanca(
                            hijo: Column(
                              children: [
                                for (final d in (_horarioAbierto ? _ordenDias : [hoy]))
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(_dias[d],
                                              style: TextStyle(fontWeight: d == hoy ? FontWeight.w800 : FontWeight.w500)),
                                        ),
                                        Text(_textoHorario(d), style: TextStyle(fontWeight: d == hoy ? FontWeight.w800 : FontWeight.w600)),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                        if ((n.politicas ?? '').trim().isNotEmpty) ...[
                          const SizedBox(height: 24),
                          const TituloSeccion('Políticas'),
                          const SizedBox(height: 10),
                          TarjetaBlanca(hijo: Text(n.politicas!.trim(), style: const TextStyle(fontSize: 13.5, height: 1.5))),
                        ],
                        const SizedBox(height: 24),
                        _Resenas(negocio: n),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (hayBarra)
            BarraAccion(
              hijos: [
                if (n.precioTexto != null)
                  Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Desde', style: TextStyle(fontSize: 11.5, color: Colores.suave)),
                        Text(n.precioTexto!, style: titulo(20)),
                      ],
                    ),
                  ),
                Expanded(
                  child: wa != null
                      ? FilledButton.icon(
                          onPressed: () => Enlaces.whatsapp(context, wa, n.nombre),
                          style: FilledButton.styleFrom(backgroundColor: Colores.agave),
                          icon: const Icon(Icons.chat_bubble_outline, size: 19),
                          label: const Text('WhatsApp'),
                        )
                      : (tel != null
                          ? FilledButton.icon(
                              onPressed: () => Enlaces.llamar(context, tel),
                              icon: const Icon(Icons.call_outlined, size: 19),
                              label: const Text('Llamar'),
                            )
                          : FilledButton.icon(
                              onPressed: () => Enlaces.comoLlegar(context, s!.latitud!, s.longitud!),
                              icon: const Icon(Icons.directions_outlined, size: 19),
                              label: const Text('Cómo llegar'),
                            )),
                ),
                if (wa != null && tel != null) BotonCircular(icono: Icons.call_outlined, tooltip: 'Llamar', alTocar: () => Enlaces.llamar(context, tel)),
                if ((wa != null || tel != null) && (s?.tieneCoordenadas ?? false))
                  BotonCircular(
                    icono: Icons.directions_outlined,
                    tooltip: 'Cómo llegar',
                    alTocar: () => Enlaces.comoLlegar(context, s!.latitud!, s.longitud!),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Promo extends StatelessWidget {
  const _Promo({required this.promo});
  final Promocion promo;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colores.avisoFondo,
        borderRadius: BorderRadius.circular(18),
        border: const Border(left: BorderSide(color: Colores.grana, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(promo.titulo, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
          if ((promo.descripcion ?? '').isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(promo.descripcion!, style: const TextStyle(fontSize: 13, height: 1.35)),
          ],
          if ((promo.codigo ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('Código: ${promo.codigo}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Colores.grana)),
          ],
        ],
      ),
    );
  }
}

class _FilaOferta extends StatelessWidget {
  const _FilaOferta({required this.oferta});
  final Oferta oferta;

  @override
  Widget build(BuildContext context) {
    final precio = oferta.precioTexto;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TarjetaBlanca(
        hijo: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(oferta.nombre, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                  if (oferta.detalle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(oferta.detalle, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                  ],
                  if ((oferta.descripcion ?? '').isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(oferta.descripcion!, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, height: 1.35)),
                  ],
                ],
              ),
            ),
            if (precio != null) ...[
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(precio, style: titulo(19)),
                  if ((oferta.unidadPrecio ?? '').isNotEmpty)
                    Text(oferta.unidadPrecio!, style: const TextStyle(fontSize: 11.5, color: Colores.suave)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TarjetaUbicacion extends StatelessWidget {
  const _TarjetaUbicacion({required this.sucursal});
  final Sucursal sucursal;

  @override
  Widget build(BuildContext context) {
    final puede = sucursal.tieneCoordenadas;
    return GestureDetector(
      onTap: puede ? () => Enlaces.comoLlegar(context, sucursal.latitud!, sucursal.longitud!) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 120,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: const LinearGradient(colors: [Color(0xFFE7DCC3), Color(0xFFCFE0D6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            child: const Center(child: Icon(Icons.place, size: 38, color: Colores.grana)),
          ),
          if ((sucursal.direccion ?? '').isNotEmpty || (sucursal.referencia ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                [sucursal.direccion, sucursal.referencia].whereType<String>().where((e) => e.isNotEmpty).join(' · '),
                style: const TextStyle(fontSize: 13, color: Colores.suave, height: 1.35),
              ),
            ),
        ],
      ),
    );
  }
}

class _Resenas extends ConsumerWidget {
  const _Resenas({required this.negocio});
  final NegocioDetalle negocio;

  /// Sin cuenta: a Ingresar. Sin correo confirmado: aviso. Si ya reseñó, abre su reseña para editarla.
  Future<void> _escribir(BuildContext context, WidgetRef ref) async {
    final mensajes = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    void aviso(String t) => mensajes
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(t)));
    var usuario = ref.read(sesionProvider).valueOrNull;
    if (usuario == null) {
      aviso('Ingresa para dejar tu reseña.');
      router.push('/ingresar');
      return;
    }
    if (!usuario.correoVerificado) {
      // Quizá ya lo confirmó desde el correo: lo comprobamos antes de avisar.
      await ref.read(sesionProvider.notifier).refrescarPerfil();
      usuario = ref.read(sesionProvider).valueOrNull ?? usuario;
    }
    if (!usuario.correoVerificado) {
      aviso('Confirma tu correo para dejar reseñas. Abre el enlace que te enviamos.');
      return;
    }
    try {
      final existente = await ref.read(repositorioDetalleProvider).miResena(negocio.id);
      final n = negocio;
      final cambio = await router.push<bool>(
        '/resena',
        extra: EscribirResenaArgs(
          negocio: NegocioParaResena(
            id: n.id,
            slug: n.slug,
            nombre: n.nombre,
            subtitulo: n.categoriaNombre,
            portadaUrl: n.fotos.isEmpty ? null : n.fotos.first.url,
          ),
          existente: existente,
        ),
      );
      if (cambio == true) {
        ref.invalidate(resenasProvider(n.slug));
        ref.invalidate(negocioProvider(n.slug));
        ref.invalidate(misResenasProvider);
      }
    } catch (e) {
      aviso(ErrorApi.desde(e).general);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(resenasProvider(negocio.slug));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TituloSeccion(
          'Reseñas',
          accion: 'Escribir reseña',
          alAccion: () => _escribir(context, ref),
        ),
        const SizedBox(height: 10),
        datos.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.5))),
          error: (_, __) => const Text('No pudimos cargar las reseñas.', style: TextStyle(color: Colores.suave)),
          data: (r) {
            if (r.total == 0) {
              return const TarjetaBlanca(
                hijo: Text('Todavía no hay reseñas. Sé la primera persona en contar cómo te fue.', style: TextStyle(height: 1.4)),
              );
            }
            final maxVal = r.distribucion.values.fold<int>(1, (a, b) => b > a ? b : a);
            return Column(
              children: [
                TarjetaBlanca(
                  hijo: Row(
                    children: [
                      Column(
                        children: [
                          Text(r.promedio.toStringAsFixed(1), style: titulo(38)),
                          const Icon(Icons.star_rounded, color: Colores.maiz, size: 18),
                          Text('${r.total} reseñas', style: const TextStyle(fontSize: 12, color: Colores.suave)),
                        ],
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: Column(
                          children: [
                            for (var e = 5; e >= 1; e--)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(
                                  children: [
                                    Text('$e', style: const TextStyle(fontSize: 12, color: Colores.suave)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: LinearProgressIndicator(
                                          value: (r.distribucion[e] ?? 0) / maxVal,
                                          minHeight: 7,
                                          backgroundColor: Colores.cantera,
                                          color: Colores.maiz,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                for (final x in r.resenas.take(3)) ...[
                  const SizedBox(height: 10),
                  TarjetaBlanca(
                    hijo: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(child: Text(x.autorNombre, style: const TextStyle(fontWeight: FontWeight.w800))),
                            const SizedBox(width: 8),
                            Text('★' * x.calificacion.clamp(0, 5), style: const TextStyle(color: Colores.maiz, fontSize: 13)),
                          ],
                        ),
                        if ((x.titulo ?? '').isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(x.titulo!, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                        if ((x.texto ?? '').isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(x.texto!, style: const TextStyle(fontSize: 13.5, height: 1.45)),
                        ],
                        if ((x.respuesta ?? '').isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: Colores.cantera, borderRadius: BorderRadius.circular(12)),
                            child: Text('Respuesta del negocio: ${x.respuesta}', style: const TextStyle(fontSize: 12.5, height: 1.4)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}
