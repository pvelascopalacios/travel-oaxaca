import '../../core/sesion/modelos.dart';

DateTime? _fecha(dynamic v) => DateTime.tryParse((v ?? '').toString())?.toLocal();

/// Mi perfil completo (GET /mi/perfil).
class PerfilCuenta {
  const PerfilCuenta({
    required this.id,
    required this.correo,
    required this.nombre,
    this.telefonoE164,
    this.idiomaCodigo = 'es',
    this.correoVerificado = false,
    this.roles = const [],
  });

  final String id;
  final String correo;
  final String nombre;
  final String? telefonoE164;
  final String idiomaCodigo;
  final bool correoVerificado;
  final List<String> roles;

  factory PerfilCuenta.desdeJson(Map<String, dynamic> j) => PerfilCuenta(
        id: (j['id'] ?? '').toString(),
        correo: (j['correo'] ?? '').toString(),
        nombre: (j['nombre'] ?? '').toString(),
        telefonoE164: (j['telefonoE164'] ?? '').toString().isEmpty ? null : j['telefonoE164'].toString(),
        idiomaCodigo: (j['idiomaCodigo'] ?? 'es').toString(),
        correoVerificado: j['correoVerificado'] == true,
        roles: ((j['roles'] as List?) ?? const []).map((e) => e.toString()).toList(),
      );

  Usuario aUsuario() => Usuario(
        id: id,
        correo: correo,
        nombre: nombre,
        idiomaCodigo: idiomaCodigo,
        correoVerificado: correoVerificado,
        roles: roles,
      );
}

class SesionActiva {
  const SesionActiva({required this.id, required this.plataforma, this.versionApp, this.creadoEn, this.actual = false});

  final String id;
  final String plataforma;
  final String? versionApp;
  final DateTime? creadoEn;
  final bool actual;

  factory SesionActiva.desdeJson(Map<String, dynamic> j) => SesionActiva(
        id: (j['id'] ?? '').toString(),
        plataforma: (j['plataforma'] ?? '').toString(),
        versionApp: (j['versionApp'] ?? '').toString().isEmpty ? null : j['versionApp'].toString(),
        creadoEn: _fecha(j['creadoEn']),
        actual: j['actual'] == true,
      );
}

class Consentimiento {
  const Consentimiento({required this.tipo, required this.versionTexto, required this.aceptado, this.fecha});

  final String tipo;
  final String versionTexto;
  final bool aceptado;
  final DateTime? fecha;

  factory Consentimiento.desdeJson(Map<String, dynamic> j) => Consentimiento(
        tipo: (j['tipo'] ?? '').toString(),
        versionTexto: (j['versionTexto'] ?? '').toString(),
        aceptado: j['aceptado'] == true,
        fecha: _fecha(j['fecha']),
      );
}

/// De un historial (más reciente primero) deja solo el último registro de cada tipo.
Map<String, Consentimiento> ultimoPorTipo(List<Consentimiento> historial) {
  final r = <String, Consentimiento>{};
  for (final c in historial) {
    r.putIfAbsent(c.tipo, () => c);
  }
  return r;
}

class SolicitudPrivacidad {
  const SolicitudPrivacidad({required this.id, required this.tipo, required this.estado, this.detalle, this.creadoEn});

  final String id;
  final String tipo;
  final String estado;
  final String? detalle;
  final DateTime? creadoEn;

  bool get abierta => estado == 'recibida' || estado == 'en_proceso';

  factory SolicitudPrivacidad.desdeJson(Map<String, dynamic> j) => SolicitudPrivacidad(
        id: (j['id'] ?? '').toString(),
        tipo: (j['tipo'] ?? '').toString(),
        estado: (j['estado'] ?? '').toString(),
        detalle: j['detalle']?.toString(),
        creadoEn: _fecha(j['creadoEn']),
      );
}

class IdiomaApp {
  const IdiomaApp({required this.codigo, required this.nombre, this.esIndigena = false});
  final String codigo;
  final String nombre;
  final bool esIndigena;

  factory IdiomaApp.desdeJson(Map<String, dynamic> j) =>
      IdiomaApp(codigo: (j['codigo'] ?? '').toString(), nombre: (j['nombre'] ?? '').toString(), esIndigena: j['esIndigena'] == true);
}
