import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/tema.dart';
import '../detalle/modelos.dart';
import '../detalle/repositorio.dart';
import '../explorar/widgets.dart';
import 'escribir_resena_pantalla.dart';
import 'utiles.dart';

/// Perfil → Mis reseñas: lo que escribí, con opción de editar o eliminar.
class MisResenasPantalla extends ConsumerWidget {
  const MisResenasPantalla({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(misResenasProvider);
    return Scaffold(
      backgroundColor: Colores.crema,
      appBar: AppBar(
        backgroundColor: Colores.crema,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 20), onPressed: () => context.pop()),
        title: Text('Mis reseñas', style: titulo(18)),
      ),
      body: datos.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoVacio(
          icono: Icons.cloud_off,
          titulo: 'No pudimos cargar',
          texto: ErrorApi.desde(e).general,
          accion: () => ref.invalidate(misResenasProvider),
        ),
        data: (lista) {
          if (lista.isEmpty) {
            return EstadoVacio(
              icono: Icons.rate_review_outlined,
              titulo: 'Aún no has escrito reseñas',
              texto: 'Cuéntanos cómo te fue en un lugar que visitaste. Ayudas a quien viene después.',
              accion: () => context.go('/explorar'),
              textoAccion: 'Explorar negocios',
            );
          }
          final promedio = lista.fold<int>(0, (a, b) => a + b.resena.calificacion) / lista.length;
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(misResenasProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 6, 18, 30),
              children: [
                Row(
                  children: [
                    Expanded(child: _Dato(valor: '${lista.length}', texto: lista.length == 1 ? 'reseña escrita' : 'reseñas escritas')),
                    const SizedBox(width: 10),
                    Expanded(child: _Dato(valor: promedio.toStringAsFixed(1), texto: 'tu promedio', estrella: true)),
                  ],
                ),
                const SizedBox(height: 14),
                for (final r in lista) ...[
                  _TarjetaResena(item: r),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.valor, required this.texto, this.estrella = false});
  final String valor;
  final String texto;
  final bool estrella;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colores.linea)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(valor, style: titulo(24)),
              if (estrella) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.star_rounded, size: 20, color: Colores.maiz)),
            ],
          ),
          Text(texto, style: const TextStyle(fontSize: 12, color: Colores.suave)),
        ],
      ),
    );
  }
}

class _TarjetaResena extends ConsumerWidget {
  const _TarjetaResena({required this.item});
  final MiResena item;

  NegocioParaResena get _negocio => NegocioParaResena(
        id: item.negocioId,
        slug: item.negocioSlug,
        nombre: item.negocioNombre,
        subtitulo: item.municipioNombre,
        categoriaClave: item.categoriaClave,
      );

  Future<void> _editar(BuildContext context, WidgetRef ref) async {
    final cambio = await context.push<bool>('/resena', extra: EscribirResenaArgs(negocio: _negocio, existente: item.resena));
    if (cambio == true) _refrescar(ref);
  }

  Future<void> _borrar(BuildContext context, WidgetRef ref) async {
    final mensajes = ScaffoldMessenger.of(context);
    final seguro = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => ConfirmarBorrarResena(nombreNegocio: item.negocioNombre),
    );
    if (seguro != true) return;
    try {
      await ref.read(repositorioDetalleProvider).borrarResena(item.resena.id);
      _refrescar(ref);
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Eliminamos tu reseña.')));
    } catch (e) {
      mensajes
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(ErrorApi.desde(e).general)));
    }
  }

  void _refrescar(WidgetRef ref) {
    ref.invalidate(misResenasProvider);
    ref.invalidate(resenasProvider(item.negocioSlug));
    ref.invalidate(negocioProvider(item.negocioSlug));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = item.resena;
    final fecha = r.fechaVisita != null ? 'Visita: ${mesAnio(r.fechaVisita!)}' : (r.creadoEn != null ? 'Escrita: ${fechaCorta(r.creadoEn!.toLocal())}' : '');
    final subtitulo = [if ((item.municipioNombre ?? '').isNotEmpty) item.municipioNombre!].join(' · ');
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => context.push('/negocio/${item.negocioSlug}'),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 6, 14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  FotoNegocio(url: null, nombre: item.negocioNombre, radio: 12, alto: 46, ancho: 46, icono: iconoCategoria(item.categoriaClave)),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.negocioNombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                        if (subtitulo.isNotEmpty) Text(subtitulo, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Colores.suave)),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_horiz, color: Colores.suave),
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    onSelected: (v) => v == 'editar' ? _editar(context, ref) : _borrar(context, ref),
                    itemBuilder: (_) => [
                      if (!r.noPublicada) const PopupMenuItem(value: 'editar', child: Text('Editar reseña', style: TextStyle(fontWeight: FontWeight.w600))),
                      const PopupMenuItem(value: 'borrar', child: Text('Eliminar', style: TextStyle(fontWeight: FontWeight.w600, color: Colores.grana))),
                    ],
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text('★' * r.calificacion.clamp(0, 5), style: const TextStyle(color: Colores.maiz, fontSize: 16, letterSpacing: 1)),
                        Text('★' * (5 - r.calificacion.clamp(0, 5)), style: const TextStyle(color: Color(0xFFE3D8C4), fontSize: 16, letterSpacing: 1)),
                        const Spacer(),
                        Text(fecha, style: const TextStyle(fontSize: 12, color: Colores.suave)),
                      ],
                    ),
                    if ((r.titulo ?? '').isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(r.titulo!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                    ],
                    if ((r.texto ?? '').isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(r.texto!, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, height: 1.42, color: Color(0xFF4A3D30))),
                    ],
                    if (r.pendiente || r.noPublicada) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: r.pendiente ? const Color(0xFFFBF3DF) : Colores.avisoFondo,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          r.pendiente ? 'En revisión: aún no se muestra' : 'El equipo la revisó y no se publicó',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: r.pendiente ? const Color(0xFF8A6100) : Colores.grana),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
