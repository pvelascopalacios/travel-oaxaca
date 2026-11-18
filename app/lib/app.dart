import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/tema.dart';
import 'router.dart';

class TravelOaxacaApp extends ConsumerWidget {
  const TravelOaxacaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Travel Oaxaca',
      debugShowCheckedModeBanner: false,
      theme: construirTema(),
      routerConfig: router,
    );
  }
}
