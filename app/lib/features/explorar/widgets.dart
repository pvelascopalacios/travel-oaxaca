import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/tema.dart';
import '../detalle/widgets.dart' show BotonCorazon;
import 'modelos.dart';

const _tonos = [Colores.grana, Colores.barro, Colores.agave, Colores.maiz];

Color tonoDe(String texto) {
  var h = 0;
  for (final c in texto.codeUnits) {
    h = (h * 31 + c) & 0x7fffffff;
  }
  return _tonos[h % _tonos.length];
}

/// Icono de la categoría para los fondos sin foto.
IconData iconoCategoria(String? clave) {
  final c = (clave ?? '').toLowerCase();
  if (c.contains('mezcal') || c.contains('bar') || c.contains('palenque')) return Icons.local_bar_outlined;
  if (c.contains('dorm') || c.contains('hosped') || c.contains('hotel') || c.contains('aloj') || c.contains('cabana') || c.contains('posada')) {
    return Icons.bed_outlined;
  }
  if (c.contains('com') || c.contains('rest') || c.contains('gastro') || c.contains('fonda') || c.contains('cafe')) {
    return Icons.restaurant_outlined;
  }
  if (c.contains('tour') || c.contains('experien') || c.contains('guia') || c.contains('excurs')) return Icons.explore_outlined;
  if (c.contains('artes') || c.contains('tienda') || c.contains('compr')) return Icons.shopping_bag_outlined;
  return Icons.storefront_outlined;
}

/// Foto con respaldo: si no hay foto o falla, un fondo de la paleta con el icono de su categoría
/// (o la inicial, si no se manda icono).
class FotoNegocio extends StatelessWidget {
  const FotoNegocio({super.key, required this.url, required this.nombre, this.radio = 14, this.alto, this.ancho, this.icono});

  final String? url;
  final String nombre;
  final double radio;
  final double? alto;
  final double? ancho;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final u = urlImagen(url);
    final tono = tonoDe(nombre);
    final tam = ((alto ?? 80) < (ancho ?? 1000) ? (alto ?? 80) : (ancho ?? 80)) * 0.38;
    final respaldo = Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [tono.withValues(alpha: 0.9), tono.withValues(alpha: 0.55)],
        ),
      ),
      alignment: Alignment.center,
      child: icono != null
          ? Icon(icono, size: tam.clamp(22.0, 48.0), color: Colors.white.withValues(alpha: 0.85))
          : Text(
              nombre.isEmpty ? '?' : nombre.trim()[0].toUpperCase(),
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white),
            ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radio),
      child: SizedBox(
        height: alto,
        width: ancho,
        child: u == null ? respaldo : Image.network(u, fit: BoxFit.cover, errorBuilder: (_, __, ___) => respaldo),
      ),
    );
  }
}

class EstrellaCalif extends StatelessWidget {
  const EstrellaCalif({super.key, required this.calificacion, required this.total});

  final double? calificacion;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (calificacion == null || total == 0) {
      return const SizedBox.shrink();
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 16, color: Colores.maiz),
        const SizedBox(width: 2),
        Text(calificacion!.toStringAsFixed(1), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
        Text(' ($total)', style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
      ],
    );
  }
}

class EtiquetaAbierto extends StatelessWidget {
  const EtiquetaAbierto(this.abierto, {super.key});
  final bool? abierto;

  @override
  Widget build(BuildContext context) {
    if (abierto == null) return const SizedBox.shrink();
    return Text(
      abierto! ? 'Abierto' : 'Cerrado',
      style: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        color: abierto! ? Colores.ok : Colores.suave,
      ),
    );
  }
}

/// Tarjeta grande de la portada (foto arriba).
class TarjetaNegocioGrande extends StatelessWidget {
  const TarjetaNegocioGrande({super.key, required this.negocio, required this.alTocar});

  final NegocioTarjeta negocio;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: alTocar,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colores.linea),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  FotoNegocio(url: negocio.portadaUrl, nombre: negocio.nombre, radio: 19, alto: 150, ancho: double.infinity, icono: iconoCategoria(negocio.categoriaClave)),
                  if (negocio.categoriaNombre != null)
                    Positioned(
                      left: 10,
                      top: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                        child: Text(negocio.categoriaNombre!,
                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colores.grana)),
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(negocio.nombre,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(18)),
                        ),
                        if (negocio.verificado) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified, size: 17, color: Colores.agave),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(negocio.municipioNombre ?? '', style: const TextStyle(fontSize: 13, color: Colores.suave)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 12,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        EstrellaCalif(calificacion: negocio.calificacion, total: negocio.totalResenas),
                        EtiquetaAbierto(negocio.abiertoAhora),
                        if (negocio.precioTexto != null)
                          Text(negocio.precioTexto!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      ],
                    ),
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

/// Tarjeta de lista para los resultados: foto a la izquierda, datos y corazón.
class TarjetaNegocioFila extends StatelessWidget {
  const TarjetaNegocioFila({super.key, required this.negocio, required this.alTocar});

  final NegocioTarjeta negocio;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: alTocar,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
          child: Stack(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FotoNegocio(url: negocio.portadaUrl, nombre: negocio.nombre, radio: 16, alto: 128, ancho: 112, icono: iconoCategoria(negocio.categoriaClave)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 34),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(negocio.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(16.5)),
                              ),
                              if (negocio.verificado) ...[
                                const SizedBox(width: 5),
                                const Icon(Icons.verified, size: 15, color: Colores.agave),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(negocio.ubicacion,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                          const SizedBox(height: 8),
                          EstrellaCalif(calificacion: negocio.calificacion, total: negocio.totalResenas),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 10,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              EtiquetaAbierto(negocio.abiertoAhora),
                              if (negocio.precioTexto != null)
                                Text(negocio.precioTexto!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                            ],
                          ),
                          if (negocio.distanciaTexto != null) ...[
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.place_outlined, size: 14, color: Colores.suave),
                                const SizedBox(width: 2),
                                Text(negocio.distanciaTexto!, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(
                right: 0,
                top: 0,
                child: BotonCorazon(
                  tipo: 'negocio',
                  id: negocio.id,
                  nombre: negocio.nombre,
                  slug: negocio.slug,
                  imagenUrl: negocio.portadaUrl,
                  sombra: false,
                  tam: 32,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TarjetaLugarFila extends StatelessWidget {
  const TarjetaLugarFila({super.key, required this.lugar, required this.alTocar});

  final LugarTarjeta lugar;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: alTocar,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Colores.linea)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FotoNegocio(url: lugar.portadaUrl, nombre: lugar.nombre, alto: 80, ancho: 80, icono: Icons.landscape_outlined),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(lugar.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(16)),
                    const SizedBox(height: 2),
                    Text([lugar.tipo, lugar.municipioNombre].whereType<String>().where((e) => e.isNotEmpty).join(' · '),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                    if (lugar.resumen != null && lugar.resumen!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(lugar.resumen!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, height: 1.3)),
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

class EstadoVacio extends StatelessWidget {
  const EstadoVacio({super.key, required this.icono, required this.titulo, required this.texto, this.accion, this.textoAccion});

  final IconData icono;
  final String titulo;
  final String texto;
  final VoidCallback? accion;
  final String? textoAccion;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 40, color: Colores.suave),
            const SizedBox(height: 12),
            Text(titulo, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(texto, textAlign: TextAlign.center, style: const TextStyle(color: Colores.suave, height: 1.4)),
            if (accion != null) ...[
              const SizedBox(height: 14),
              OutlinedButton(onPressed: accion, child: Text(textoAccion ?? 'Reintentar')),
            ],
          ],
        ),
      ),
    );
  }
}


/// Tarjeta alta de los carruseles de Explorar: foto grande, corazón y datos debajo.
class TarjetaNegocioAlta extends StatelessWidget {
  const TarjetaNegocioAlta({super.key, required this.negocio, required this.alTocar});

  final NegocioTarjeta negocio;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final precio = negocio.precioTexto;
    return SizedBox(
      width: 172,
      child: GestureDetector(
        onTap: alTocar,
        behavior: HitTestBehavior.opaque,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                FotoNegocio(url: negocio.portadaUrl, nombre: negocio.nombre, radio: 22, alto: 210, ancho: 172, icono: iconoCategoria(negocio.categoriaClave)),
                Positioned(
                  right: 10,
                  top: 10,
                  child: BotonCorazon(
                    tipo: 'negocio',
                    id: negocio.id,
                    nombre: negocio.nombre,
                    slug: negocio.slug,
                    imagenUrl: negocio.portadaUrl,
                  ),
                ),
                if (negocio.verificado)
                  Positioned(
                    left: 10,
                    bottom: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified, size: 14, color: Colores.agave),
                          SizedBox(width: 4),
                          Text('Verificado',
                              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colores.agave)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 9),
            Text(negocio.nombre,
                maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(15.5)),
            const SizedBox(height: 4),
            EstrellaCalif(calificacion: negocio.calificacion, total: negocio.totalResenas),
            const SizedBox(height: 3),
            Wrap(
              spacing: 6,
              children: [
                if (precio != null) Text(precio, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                EtiquetaAbierto(negocio.abiertoAhora),
              ],
            ),
            if ((negocio.municipioNombre ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(negocio.municipioNombre!,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
              ),
          ],
        ),
      ),
    );
  }
}


/// Bloque de fecha (día y mes) para eventos.
class BloqueFecha extends StatelessWidget {
  const BloqueFecha({super.key, required this.evento, this.tam = 58});
  final EventoTarjeta evento;
  final double tam;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: tam,
      height: tam,
      decoration: BoxDecoration(color: Colores.avisoFondo, borderRadius: BorderRadius.circular(16)),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(evento.diaTexto, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colores.grana, height: 1)),
          const SizedBox(height: 2),
          Text(evento.mesTexto, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colores.grana, letterSpacing: 0.6)),
        ],
      ),
    );
  }
}

class TarjetaEventoFila extends StatelessWidget {
  const TarjetaEventoFila({super.key, required this.evento, required this.alTocar});
  final EventoTarjeta evento;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: alTocar,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Colores.linea)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BloqueFecha(evento: evento),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(evento.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(16)),
                    const SizedBox(height: 3),
                    Text(
                      [evento.fechasTexto, if (evento.lugarTexto.isNotEmpty) evento.lugarTexto].join(' · '),
                      style: const TextStyle(fontSize: 12.5, color: Colores.suave),
                    ),
                    if (evento.descripcion != null && evento.descripcion!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(evento.descripcion!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, height: 1.3)),
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

/// Tarjeta de evento para el carrusel de Explorar.
class TarjetaEventoCarrusel extends StatelessWidget {
  const TarjetaEventoCarrusel({super.key, required this.evento, required this.alTocar});
  final EventoTarjeta evento;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final tono = tonoDe(evento.nombre);
    return SizedBox(
      width: 250,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: alTocar,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    BloqueFecha(evento: evento, tam: 54),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: tono.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
                        child: Text(
                          evento.temporadaNombre ?? evento.fechasTexto,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tono),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(evento.nombre, maxLines: 2, overflow: TextOverflow.ellipsis, style: titulo(16)),
                const SizedBox(height: 4),
                Text(
                  [evento.fechasTexto, if (evento.lugarTexto.isNotEmpty) evento.lugarTexto].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: Colores.suave),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


/// Tarjeta ancha de resultados: foto arriba, datos debajo.
class TarjetaNegocioAncha extends StatelessWidget {
  const TarjetaNegocioAncha({super.key, required this.negocio, required this.alTocar});

  final NegocioTarjeta negocio;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final nuevo = negocio.totalResenas == 0 || negocio.calificacion == null;
    final datos = <Widget>[
      if (nuevo)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
          decoration: BoxDecoration(color: const Color(0xFFFBE8EE), borderRadius: BorderRadius.circular(20)),
          child: const Text('Nuevo', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colores.grana)),
        )
      else
        EstrellaCalif(calificacion: negocio.calificacion, total: negocio.totalResenas),
      if (negocio.abiertoAhora != null) EtiquetaAbierto(negocio.abiertoAhora),
      if (negocio.precioTexto != null)
        Text(negocio.precioTexto!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
      if (negocio.distanciaTexto != null)
        Text(negocio.distanciaTexto!, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
    ];
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: alTocar,
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: Colores.linea)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  FotoNegocio(
                    url: negocio.portadaUrl,
                    nombre: negocio.nombre,
                    radio: 21,
                    alto: 132,
                    ancho: double.infinity,
                    icono: iconoCategoria(negocio.categoriaClave),
                  ),
                  Positioned(
                    right: 10,
                    top: 10,
                    child: BotonCorazon(
                      tipo: 'negocio',
                      id: negocio.id,
                      nombre: negocio.nombre,
                      slug: negocio.slug,
                      imagenUrl: negocio.portadaUrl,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(negocio.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: titulo(17))),
                        if (negocio.verificado) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.verified, size: 16, color: Colores.agave),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(negocio.ubicacion,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Colores.suave)),
                    const SizedBox(height: 9),
                    Wrap(spacing: 14, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: datos),
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

/// Tarjeta chica de lugar para el carrusel de resultados.
class TarjetaLugarMini extends StatelessWidget {
  const TarjetaLugarMini({super.key, required this.lugar, required this.alTocar});
  final LugarTarjeta lugar;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: alTocar,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 150,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FotoNegocio(url: lugar.portadaUrl, nombre: lugar.nombre, radio: 18, alto: 96, ancho: 150, icono: Icons.landscape_outlined),
            const SizedBox(height: 7),
            Text(lugar.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            Text(
              [lugar.tipo, lugar.municipioNombre].whereType<String>().where((e) => e.isNotEmpty).join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: Colores.suave),
            ),
          ],
        ),
      ),
    );
  }
}
