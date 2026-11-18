import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/respuesta.dart';
import '../../core/sesion/sesion.dart';
import '../../core/tema.dart';
import '../explorar/widgets.dart';
import 'modelos.dart';
import 'repositorio.dart';

/// Corazón que guarda o quita un favorito. Sin cuenta, lleva a ingresar.
class BotonCorazon extends ConsumerWidget {
  const BotonCorazon({
    super.key,
    required this.tipo,
    required this.id,
    this.nombre = '',
    this.slug = '',
    this.imagenUrl,
    this.tam = 34,
    this.sombra = true,
  });

  final String tipo;
  final String id;
  final String nombre;
  final String slug;
  final String? imagenUrl;
  final double tam;
  final bool sombra;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activo = ref.watch(favoritosProvider.select((a) => (a.valueOrNull ?? const <Favorito>[]).any((f) => f.tipo == tipo && f.id == id)));
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final usuario = ref.read(sesionProvider).valueOrNull;
        final mensajes = ScaffoldMessenger.of(context);
        if (usuario == null) {
          mensajes
            ..hideCurrentSnackBar()
            ..showSnackBar(const SnackBar(content: Text('Ingresa para guardar tus favoritos.')));
          context.push('/ingresar');
          return;
        }
        try {
          await ref.read(favoritosProvider.notifier).alternar(tipo, id, nombre: nombre, slug: slug, imagenUrl: imagenUrl);
        } catch (e) {
          mensajes
            ..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(ErrorApi.desde(e).general)));
        }
      },
      child: Container(
        width: tam,
        height: tam,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          shape: BoxShape.circle,
          boxShadow: sombra ? const [BoxShadow(color: Color(0x26000000), blurRadius: 6, offset: Offset(0, 2))] : null,
        ),
        child: Icon(activo ? Icons.favorite : Icons.favorite_border, size: tam * 0.55, color: activo ? Colores.grana : Colores.tinta),
      ),
    );
  }
}

/// Botón redondo claro, para sobre las fotos.
class BotonVidrio extends StatelessWidget {
  const BotonVidrio({super.key, required this.icono, required this.alTocar});
  final IconData icono;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: alTocar,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.94),
          shape: BoxShape.circle,
          boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 10, offset: Offset(0, 3))],
        ),
        child: Icon(icono, size: 21, color: Colores.tinta),
      ),
    );
  }
}

void volver(BuildContext context) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go('/explorar');
  }
}

/// Carrusel de fotos con contador.
class GaleriaFotos extends StatefulWidget {
  const GaleriaFotos({super.key, required this.fotos, required this.nombre});
  final List<Foto> fotos;
  final String nombre;

  @override
  State<GaleriaFotos> createState() => _GaleriaFotosState();
}

class _GaleriaFotosState extends State<GaleriaFotos> {
  int _i = 0;

  @override
  Widget build(BuildContext context) {
    final n = widget.fotos.length;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (n == 0)
          FotoNegocio(url: null, nombre: widget.nombre, radio: 0)
        else
          PageView.builder(
            itemCount: n,
            onPageChanged: (v) => setState(() => _i = v),
            itemBuilder: (_, i) => FotoNegocio(url: widget.fotos[i].url, nombre: widget.nombre, radio: 0),
          ),
        const IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.center,
                colors: [Color(0x66000000), Colors.transparent],
              ),
            ),
          ),
        ),
        if (n > 1)
          Positioned(
            right: 16,
            bottom: 44,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(20)),
              child: Text('${_i + 1} / $n', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ),
      ],
    );
  }
}

/// Cabecera con foto que se compacta al bajar (ficha, lugar y evento con foto).
class CabeceraFoto extends StatelessWidget {
  const CabeceraFoto({super.key, required this.fotos, required this.nombre, required this.corazon});
  final List<Foto> fotos;
  final String nombre;
  final Widget corazon;

  static const double _alto = 360;
  static const double _barra = 60;

  @override
  Widget build(BuildContext context) {
    final arriba = MediaQuery.of(context).padding.top;
    return SliverAppBar(
      pinned: true,
      expandedHeight: _alto,
      toolbarHeight: _barra,
      backgroundColor: Colores.crema,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false,
      flexibleSpace: LayoutBuilder(builder: (context, box) {
        final min = _barra + arriba;
        final max = _alto + arriba;
        final t = ((box.maxHeight - min) / (max - min)).clamp(0.0, 1.0);
        return Stack(
          fit: StackFit.expand,
          children: [
            Opacity(
              opacity: t,
              child: IgnorePointer(
                ignoring: t < 0.6,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    GaleriaFotos(fotos: fotos, nombre: nombre),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 28,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colores.crema,
                          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              top: arriba + (_barra - 42) / 2,
              height: 42,
              child: Row(
                children: [
                  BotonVidrio(icono: Icons.arrow_back, alTocar: () => volver(context)),
                  Expanded(
                    child: Opacity(
                      opacity: (1 - t * 2).clamp(0.0, 1.0),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(18)),
                      ),
                    ),
                  ),
                  corazon,
                ],
              ),
            ),
          ],
        );
      }),
    );
  }
}

class TituloSeccion extends StatelessWidget {
  const TituloSeccion(this.texto, {super.key, this.accion, this.alAccion});
  final String texto;
  final String? accion;
  final VoidCallback? alAccion;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(texto, style: titulo(21))),
        if (accion != null)
          TextButton(
            onPressed: alAccion,
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 6), minimumSize: const Size(0, 34)),
            child: Text(accion!, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }
}

class TarjetaBlanca extends StatelessWidget {
  const TarjetaBlanca({super.key, required this.hijo, this.relleno = const EdgeInsets.all(14)});
  final Widget hijo;
  final EdgeInsets relleno;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: relleno,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colores.linea)),
      child: hijo,
    );
  }
}

class DatoRapido extends StatelessWidget {
  const DatoRapido({super.key, required this.grande, required this.chico, this.color});
  final String grande;
  final String chico;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colores.linea)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(grande, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color ?? Colores.tinta)),
            const SizedBox(height: 2),
            Text(chico, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Colores.suave, height: 1.25)),
          ],
        ),
      ),
    );
  }
}

/// Barra fija de abajo con acciones.
class BarraAccion extends StatelessWidget {
  const BarraAccion({super.key, required this.hijos});
  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    final abajo = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(18, 12, 18, 12 + abajo),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colores.linea)),
        boxShadow: [BoxShadow(color: Color(0x142B2118), blurRadius: 20, offset: Offset(0, -6))],
      ),
      child: Row(children: hijos),
    );
  }
}

class BotonCircular extends StatelessWidget {
  const BotonCircular({super.key, required this.icono, required this.alTocar, this.tooltip});
  final IconData icono;
  final VoidCallback alTocar;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 10),
      child: Tooltip(
        message: tooltip ?? '',
        child: GestureDetector(
          onTap: alTocar,
          child: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, border: Border.all(color: Colores.linea, width: 1.5)),
            child: Icon(icono, size: 22, color: Colores.tinta),
          ),
        ),
      ),
    );
  }
}

class PantallaCargando extends StatelessWidget {
  const PantallaCargando({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Align(alignment: Alignment.centerLeft, child: BotonVidrio(icono: Icons.arrow_back, alTocar: () => volver(context))),
            ),
            const Expanded(child: Center(child: CircularProgressIndicator())),
          ],
        ),
      ),
    );
  }
}

class PantallaError extends StatelessWidget {
  const PantallaError({super.key, required this.error, required this.reintentar});
  final Object error;
  final VoidCallback reintentar;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Align(alignment: Alignment.centerLeft, child: BotonVidrio(icono: Icons.arrow_back, alTocar: () => volver(context))),
            ),
            Expanded(
              child: EstadoVacio(
                icono: Icons.cloud_off_outlined,
                titulo: 'No pudimos cargar',
                texto: ErrorApi.desde(error).general,
                accion: reintentar,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
