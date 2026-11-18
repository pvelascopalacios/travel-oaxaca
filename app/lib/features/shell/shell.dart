import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/tema.dart';

/// Marco con la barra inferior flotante: Explorar, Cerca, Favoritos y Perfil.
class Shell extends StatelessWidget {
  const Shell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _items = [
    (Icons.explore_outlined, Icons.explore, 'Explorar'),
    (Icons.place_outlined, Icons.place, 'Cerca'),
    (Icons.favorite_border, Icons.favorite, 'Favoritos'),
    (Icons.person_outline, Icons.person, 'Perfil'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: Container(
            height: 66,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.96),
              borderRadius: BorderRadius.circular(30),
              boxShadow: const [BoxShadow(color: Color(0x2E2B2118), blurRadius: 24, offset: Offset(0, 8))],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < _items.length; i++)
                  _Item(
                    activo: navigationShell.currentIndex == i,
                    icono: _items[i].$1,
                    iconoActivo: _items[i].$2,
                    texto: _items[i].$3,
                    alTocar: () => navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({required this.activo, required this.icono, required this.iconoActivo, required this.texto, required this.alTocar});

  final bool activo;
  final IconData icono;
  final IconData iconoActivo;
  final String texto;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: alTocar,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: activo ? const Color(0xFFFBE8EE) : Colors.transparent,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(activo ? iconoActivo : icono, size: 23, color: activo ? Colores.grana : Colores.suave),
            const SizedBox(height: 2),
            Text(texto,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: activo ? Colores.grana : Colores.suave)),
          ],
        ),
      ),
    );
  }
}
