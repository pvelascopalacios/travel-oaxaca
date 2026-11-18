/// El usuario que devuelve la API al ingresar o registrarse.
class Usuario {
  const Usuario({
    required this.id,
    required this.correo,
    required this.nombre,
    required this.idiomaCodigo,
    required this.correoVerificado,
    required this.roles,
  });

  final String id;
  final String correo;
  final String nombre;
  final String idiomaCodigo;
  final bool correoVerificado;
  final List<String> roles;

  factory Usuario.desdeJson(Map<String, dynamic> j) {
    return Usuario(
      id: (j['id'] ?? '').toString(),
      correo: (j['correo'] ?? '').toString(),
      nombre: (j['nombre'] ?? '').toString(),
      idiomaCodigo: (j['idiomaCodigo'] ?? 'es').toString(),
      correoVerificado: j['correoVerificado'] == true,
      roles: ((j['roles'] as List?) ?? const []).map((e) => e.toString()).toList(),
    );
  }

  Map<String, dynamic> aJson() => {
        'id': id,
        'correo': correo,
        'nombre': nombre,
        'idiomaCodigo': idiomaCodigo,
        'correoVerificado': correoVerificado,
        'roles': roles,
      };

  String get primerNombre {
    final partes = nombre.trim().split(RegExp(r'\s+'));
    return partes.isEmpty ? '' : partes.first;
  }

  String get inicial => nombre.trim().isEmpty ? '?' : nombre.trim()[0].toUpperCase();
}

/// Los tokens de la sesión.
class Tokens {
  const Tokens({required this.acceso, required this.renovacion});
  final String acceso;
  final String renovacion;
}
