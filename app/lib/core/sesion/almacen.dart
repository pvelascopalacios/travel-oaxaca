import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'modelos.dart';

/// Guarda la sesión en el almacén seguro del teléfono (Keystore en Android).
class AlmacenSesion {
  AlmacenSesion([FlutterSecureStorage? almacen])
      : _almacen = almacen ?? const FlutterSecureStorage();

  final FlutterSecureStorage _almacen;

  static const _kAcceso = 'token_acceso';
  static const _kRenovacion = 'token_renovacion';
  static const _kUsuario = 'usuario';

  Future<Tokens?> leerTokens() async {
    final a = await _almacen.read(key: _kAcceso);
    final r = await _almacen.read(key: _kRenovacion);
    if (a == null || r == null) return null;
    return Tokens(acceso: a, renovacion: r);
  }

  Future<Usuario?> leerUsuario() async {
    final crudo = await _almacen.read(key: _kUsuario);
    if (crudo == null) return null;
    try {
      return Usuario.desdeJson(jsonDecode(crudo) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> guardarTokens(Tokens t) async {
    await _almacen.write(key: _kAcceso, value: t.acceso);
    await _almacen.write(key: _kRenovacion, value: t.renovacion);
  }

  Future<void> guardarUsuario(Usuario u) async {
    await _almacen.write(key: _kUsuario, value: jsonEncode(u.aJson()));
  }

  Future<void> borrar() async {
    await _almacen.delete(key: _kAcceso);
    await _almacen.delete(key: _kRenovacion);
    await _almacen.delete(key: _kUsuario);
  }
}
