import 'package:flutter/widgets.dart' show ValueKey;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/ingresar_pantalla.dart';
import 'features/cerca/cerca_pantalla.dart';
import 'features/auth/olvide_pantalla.dart';
import 'features/auth/registro_pantalla.dart';
import 'features/cuenta/clave_pantalla.dart';
import 'features/cuenta/datos_personales_pantalla.dart';
import 'features/cuenta/privacidad_pantalla.dart';
import 'features/cuenta/sesiones_pantalla.dart';
import 'features/detalle/evento_pantalla.dart';
import 'features/detalle/ficha_negocio.dart';
import 'features/detalle/lugar_pantalla.dart';
import 'features/explorar/buscar_pantalla.dart';
import 'features/explorar/explorar_pantalla.dart';
import 'features/explorar/modelos.dart';
import 'features/listas/lista_pantalla.dart';
import 'features/listas/mis_listas_pantalla.dart';
import 'features/perfil/favoritos_pantalla.dart';
import 'features/rutas/ruta_pantalla.dart';
import 'features/rutas/rutas_pantalla.dart';
import 'features/resenas/escribir_resena_pantalla.dart';
import 'features/resenas/mis_resenas_pantalla.dart';
import 'features/perfil/perfil_pantalla.dart';
import 'features/shell/shell.dart';

/// Rutas de la app. Sin cuenta se puede ver todo; solo favoritos y perfil piden ingresar.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/explorar',
    routes: [
      GoRoute(
        path: '/buscar',
        builder: (c, s) => BuscarPantalla(
          key: ValueKey(s.uri.toString() + (s.extra?.hashCode.toString() ?? '')),
          vistaInicial: s.uri.queryParameters['tab'] == 'eventos'
              ? 2
              : (s.extra is FiltrosNegocios && (s.extra as FiltrosNegocios).hayFiltros ? 0 : -1),
          inicial: s.extra is FiltrosNegocios ? s.extra as FiltrosNegocios : FiltrosNegocios(q: s.uri.queryParameters['q'] ?? ''),
        ),
      ),
      GoRoute(path: '/negocio/:slug', builder: (c, s) => FichaNegocioPantalla(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/lugar/:slug', builder: (c, s) => LugarPantalla(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/rutas', builder: (c, s) => const RutasPantalla()),
      GoRoute(path: '/ruta/:slug', builder: (c, s) => RutaPantalla(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/listas', builder: (c, s) => const MisListasPantalla()),
      GoRoute(path: '/lista/:id', builder: (c, s) => ListaPantalla(id: s.pathParameters['id']!)),
      GoRoute(path: '/evento/:slug', builder: (c, s) => EventoPantalla(slug: s.pathParameters['slug']!)),
      GoRoute(
        path: '/resena',
        builder: (c, s) => s.extra is EscribirResenaArgs
            ? EscribirResenaPantalla(args: s.extra as EscribirResenaArgs)
            : const MisResenasPantalla(),
      ),
      GoRoute(path: '/cuenta/datos', builder: (c, s) => const DatosPersonalesPantalla()),
      GoRoute(path: '/cuenta/clave', builder: (c, s) => const ClavePantalla()),
      GoRoute(path: '/cuenta/sesiones', builder: (c, s) => const SesionesPantalla()),
      GoRoute(path: '/cuenta/privacidad', builder: (c, s) => const PrivacidadPantalla()),
      GoRoute(path: '/mis-resenas', builder: (c, s) => const MisResenasPantalla()),
      GoRoute(path: '/ingresar', builder: (c, s) => const IngresarPantalla()),
      GoRoute(path: '/registro', builder: (c, s) => const RegistroPantalla()),
      GoRoute(path: '/olvide-clave', builder: (c, s) => const OlvidePantalla()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => Shell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/explorar',
              builder: (c, s) => const ExplorarPantalla(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/cerca',
              builder: (c, s) => const CercaPantalla(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/favoritos', builder: (c, s) => const FavoritosPantalla()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/perfil', builder: (c, s) => const PerfilPantalla()),
          ]),
        ],
      ),
    ],
  );
});
