import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Paleta aprobada: grana, barro, agave y maíz sobre base crema.
class Colores {
  static const Color grana = Color(0xFFA5174F);
  static const Color granaOscuro = Color(0xFF86113E);
  static const Color barro = Color(0xFFB5653A);
  static const Color agave = Color(0xFF17707B);
  static const Color maiz = Color(0xFFE9A21B);
  static const Color crema = Color(0xFFFBF7EF);
  static const Color tinta = Color(0xFF2B2118);
  static const Color suave = Color(0xFF7A6C5C);
  static const Color linea = Color(0xFFEADFCC);
  static const Color cantera = Color(0xFFF1EBDD);
  static const Color ok = Color(0xFF41692F);
  static const Color okFondo = Color(0xFFEDF3EA);
  static const Color avisoFondo = Color(0xFFFDF0F4);
}

TextStyle titulo(double tamano, {Color color = Colores.tinta}) {
  return GoogleFonts.bricolageGrotesque(
    fontSize: tamano,
    fontWeight: FontWeight.w800,
    color: color,
    height: 1.15,
  );
}

ThemeData construirTema() {
  final esquema = ColorScheme.fromSeed(
    seedColor: Colores.grana,
    primary: Colores.grana,
    surface: Colors.white,
  );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: esquema,
    scaffoldBackgroundColor: Colores.crema,
  );
  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: Colores.tinta,
      displayColor: Colores.tinta,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colores.crema,
      foregroundColor: Colores.tinta,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colores.linea, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colores.linea, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colores.grana, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colores.grana, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colores.grana, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Colores.grana,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Colores.grana,
        minimumSize: const Size.fromHeight(52),
        shape: const StadiumBorder(),
        side: const BorderSide(color: Colores.grana, width: 1.5),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Colores.grana,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Colores.avisoFondo,
      surfaceTintColor: Colors.transparent,
    ),
  );
}
