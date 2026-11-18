import { describe, expect, it } from 'vitest';
import { accionPorTecla, accionesDe, urgenciaComunidad, teclaDe, errorDeMotivoFoto, estadoUsuario, iniciales, motivoNoCambiarEstado, motivoNoQuitarRol, rolesQueFaltan, rutaAccion, transicionesDe } from './comunidad';

describe('moderación', () => {
  it('una reseña pendiente se puede publicar, ocultar o rechazar', () => {
    expect(accionesDe({ tipo: 'resena', estado: 'pendiente' }).map((a) => a.accion)).toEqual(['publicar', 'ocultar', 'rechazar']);
  });
  it('una reseña oculta ya no ofrece ocultar', () => {
    expect(accionesDe({ tipo: 'resena', estado: 'oculta' }).map((a) => a.accion)).toEqual(['publicar', 'rechazar']);
    expect(accionesDe({ tipo: 'comentario', estado: 'oculto' }).map((a) => a.accion)).toEqual(['publicar', 'rechazar']);
  });
  it('la foto pide motivo solo al rechazar', () => {
    const a = accionesDe({ tipo: 'foto', estado: 'pendiente' });
    expect(a.map((x) => x.accion)).toEqual(['aprobar', 'rechazar']);
    expect(a[1].pideMotivo).toBe(true);
  });
  it('un reporte en revisión no ofrece volver a marcarlo en revisión', () => {
    expect(accionesDe({ tipo: 'reporte_ficha', estado: 'nuevo' }).map((a) => a.accion)).toEqual(['revisar', 'resolver', 'descartar']);
    expect(accionesDe({ tipo: 'reporte_contenido', estado: 'en_revision' }).map((a) => a.accion)).toEqual(['resolver', 'descartar']);
  });
  it('rutas de la API', () => {
    expect(rutaAccion('resena', 'x', 'publicar')).toBe('/revision/comunidad/resenas/x/publicar');
    expect(rutaAccion('comentario', 'x', 'ocultar')).toBe('/revision/comunidad/comentarios/x/ocultar');
    expect(rutaAccion('foto', 'x', 'aprobar')).toBe('/revision/comunidad/fotos/x/aprobar');
    expect(rutaAccion('reporte_ficha', 'x', 'revisar')).toBe('/revision/comunidad/reportes/ficha/x/revisar');
    expect(rutaAccion('reporte_contenido', 'x', 'resolver')).toBe('/revision/comunidad/reportes/contenido/x/resolver');
  });
  it('motivo de foto: 5 a 200', () => {
    expect(errorDeMotivoFoto('')).toBe('Escribe el motivo.');
    expect(errorDeMotivoFoto('abc')).toContain('entre 5 y 200');
    expect(errorDeMotivoFoto('a'.repeat(201))).toContain('entre 5 y 200');
    expect(errorDeMotivoFoto('Sin permiso')).toBeNull();
  });
});

describe('usuarios y roles', () => {
  it('solo se ofrecen los roles globales que faltan', () => {
    expect(rolesQueFaltan({ roles: ['editor', 'dueno'] })).toEqual(['admin', 'ventas']);
    expect(rolesQueFaltan({ roles: ['ROLE_ADMIN'] })).toEqual(['editor', 'ventas']);
  });
  it('no puedes quitarte el rol admin ni cambiar tu estado', () => {
    expect(motivoNoQuitarRol({ id: 'a' }, 'admin', 'a')).toContain('ti mismo');
    expect(motivoNoQuitarRol({ id: 'a' }, 'editor', 'a')).toBeNull();
    expect(motivoNoQuitarRol({ id: 'b' }, 'admin', 'a')).toBeNull();
    expect(motivoNoCambiarEstado({ id: 'a', estado: 'activo' }, 'a')).toContain('propia');
    expect(motivoNoCambiarEstado({ id: 'b', estado: 'eliminado' }, 'a')).toContain('eliminada');
    expect(motivoNoCambiarEstado({ id: 'b', estado: 'suspendido' }, 'a')).toBeNull();
  });
  it('iniciales y estados', () => {
    expect(iniciales('Mariana Ortiz', 'm@x.mx')).toBe('MO');
    expect(iniciales(null, 'rosa@correo.com')).toBe('RC');
    expect(estadoUsuario('suspendido').clase).toBe('mal');
  });
});

describe('privacidad', () => {
  it('transiciones permitidas', () => {
    expect(transicionesDe({ estado: 'recibida' }).map((t) => t.estado)).toEqual(['en_proceso', 'resuelta', 'rechazada']);
    expect(transicionesDe({ estado: 'en_proceso' }).map((t) => t.estado)).toEqual(['resuelta', 'rechazada']);
    expect(transicionesDe({ estado: 'resuelta' })).toEqual([]);
    expect(transicionesDe({ estado: 'rechazada' })).toEqual([]);
  });
  it('pasar a en proceso no cierra; resolver y rechazar sí', () => {
    const t = transicionesDe({ estado: 'recibida' });
    expect(t.map((x) => x.cierra)).toEqual([false, true, true]);
  });

  it('las teclas: P es la acción principal, O oculta, R rechaza', () => {
    expect(accionPorTecla({ tipo: 'resena', estado: 'pendiente' }, 'P')?.accion).toBe('publicar');
    expect(accionPorTecla({ tipo: 'resena', estado: 'pendiente' }, 'o')?.accion).toBe('ocultar');
    expect(accionPorTecla({ tipo: 'resena', estado: 'pendiente' }, 'r')?.accion).toBe('rechazar');
    expect(accionPorTecla({ tipo: 'foto', estado: 'pendiente' }, 'p')?.accion).toBe('aprobar');
    expect(accionPorTecla({ tipo: 'reporte_ficha', estado: 'nuevo' }, 'p')?.accion).toBe('resolver');
  });
  it('una tecla de una acción que no se ofrece no hace nada', () => {
    expect(accionPorTecla({ tipo: 'resena', estado: 'oculta' }, 'o')).toBeNull();
    expect(accionPorTecla({ tipo: 'foto', estado: 'pendiente' }, 'o')).toBeNull();
    expect(accionPorTecla({ tipo: 'resena', estado: 'pendiente' }, 'x')).toBeNull();
  });
  it('cada acción tiene una tecla distinta salvo las principales', () => {
    expect(teclaDe('descartar')).toBe('d');
    expect(teclaDe('revisar')).toBe('e');
  });
  it('urgencia: 3 reportes pesa más que la espera', () => {
    expect(urgenciaComunidad({ reportes: 3 }, 1)).toBe('urg');
    expect(urgenciaComunidad({ reportes: 1 }, 49)).toBe('cambio');
    expect(urgenciaComunidad({ reportes: 0 }, 48)).toBe('');
  });
});
