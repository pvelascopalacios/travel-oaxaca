import { describe, expect, it } from 'vitest';
import { Comentario } from './modelos';
import {
  buscarComentario, fijarMeGusta, insertarComentario, puedeResponder, quitarComentario, reemplazarComentario, totalTrasAlternar, totalVisible, unirPagina,
  validarComentario, validarReporte,
} from './comunidad';

const com = (id: string, padreId: string | null = null, extra: Partial<Comentario> = {}): Comentario => ({
  id, padreId, autorNombre: 'Luis M.', texto: 'hola', creadoEn: '2026-11-08T10:00:00Z', meGusta: 0, estado: 'publicado', respuestas: [], mio: false, yoLeDiMeGusta: false, ...extra,
});

describe('comunidad', () => {
  it('valida el comentario', () => {
    expect(validarComentario('  ')).toBe('comentarioVacio');
    expect(validarComentario('x'.repeat(1001))).toBe('comentarioLargo');
    expect(validarComentario('Fuimos temprano')).toBeNull();
    expect(validarComentario('x'.repeat(1000))).toBeNull();
  });

  it('solo los principales reciben respuestas', () => {
    expect(puedeResponder(com('a'))).toBe(true);
    expect(puedeResponder(com('b', 'a'))).toBe(false);
  });

  it('inserta principales al inicio y respuestas dentro de su comentario', () => {
    let l = [com('a')];
    l = insertarComentario(l, com('b'));
    expect(l.map((c) => c.id)).toEqual(['b', 'a']);
    l = insertarComentario(l, com('r1', 'a'));
    l = insertarComentario(l, com('r2', 'a'));
    expect(l[1].respuestas.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(totalVisible(l)).toBe(4);
    // Respuesta a un padre que no está: no se pierde ni truena.
    expect(insertarComentario(l, com('x', 'zzz'))).toHaveLength(2);
  });

  it('al editar conserva respuestas y «me gusta»', () => {
    const l = [com('a', null, { meGusta: 3, yoLeDiMeGusta: true, respuestas: [com('r', 'a')], texto: 'viejo' })];
    const n = reemplazarComentario(l, com('a', null, { texto: 'nuevo', mio: true }));
    expect(n[0].texto).toBe('nuevo');
    expect(n[0].mio).toBe(true);
    expect(n[0].meGusta).toBe(3);
    expect(n[0].yoLeDiMeGusta).toBe(true);
    expect(n[0].respuestas).toHaveLength(1);
    const m = reemplazarComentario(l, com('r', 'a', { texto: 'editada', mio: true }));
    expect(m[0].respuestas[0].texto).toBe('editada');
    expect(m[0].texto).toBe('viejo');
  });

  it('quita y busca comentarios y respuestas', () => {
    const l = [com('a', null, { respuestas: [com('r', 'a')] }), com('b')];
    expect(quitarComentario(l, 'r')[0].respuestas).toEqual([]);
    expect(quitarComentario(l, 'a').map((c) => c.id)).toEqual(['b']);
    expect(buscarComentario(l, 'r')?.id).toBe('r');
    expect(buscarComentario(l, 'nada')).toBeNull();
  });

  it('fija el «me gusta» en principales y respuestas', () => {
    const l = [com('a', null, { respuestas: [com('r', 'a', { meGusta: 1 })] })];
    const n = fijarMeGusta(l, 'r', true, 2);
    expect(n[0].respuestas[0]).toMatchObject({ yoLeDiMeGusta: true, meGusta: 2 });
    expect(n[0].yoLeDiMeGusta).toBe(false);
    expect(fijarMeGusta(l, 'a', false, -5)[0].meGusta).toBe(0);
    expect(totalTrasAlternar(4, false)).toBe(5);
    expect(totalTrasAlternar(4, true)).toBe(3);
    expect(totalTrasAlternar(0, true)).toBe(0);
  });

  it('une páginas sin repetir', () => {
    expect(unirPagina([com('a'), com('b')], [com('b'), com('c')]).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('valida el reporte', () => {
    expect(validarReporte(null, '')).toBe('reporteElegirMotivo');
    expect(validarReporte('spam', 'x'.repeat(501))).toBe('reporteDetalleLargo');
    expect(validarReporte('spam', '')).toBeNull();
  });
});
