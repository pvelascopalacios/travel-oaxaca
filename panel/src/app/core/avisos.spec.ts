import { describe, expect, it } from 'vitest';
import { Avisos, MAX_AVISOS, textoErrorFormulario } from './avisos';

describe('avisos flotantes', () => {
  it('un éxito se agrega y se puede cerrar', () => {
    const a = new Avisos();
    a.ok('Lugar guardado.');
    expect(a.lista().map((x) => x.texto)).toEqual(['Lugar guardado.']);
    a.cerrar(a.lista()[0].id);
    expect(a.lista()).toEqual([]);
  });
  it('el mismo éxito dos veces no se apila', () => {
    const a = new Avisos();
    a.ok('Guardado.'); a.ok('Guardado.');
    expect(a.lista().length).toBe(1);
  });
  it('caben pocos: el más viejo se va', () => {
    const a = new Avisos();
    for (let i = 0; i < MAX_AVISOS + 2; i++) a.ok('aviso ' + i);
    expect(a.lista().length).toBe(MAX_AVISOS);
    expect(a.lista()[0].texto).toBe('aviso 2');
  });
  it('un error no se apila con otro igual y un éxito lo quita', () => {
    const a = new Avisos();
    a.error('No se guardó: revisa 2 campos.'); a.error('No se guardó: revisa 2 campos.');
    expect(a.lista().length).toBe(1);
    a.ok('Guardado.');
    expect(a.lista().map((x) => x.tipo)).toEqual(['ok']);
  });
  it('cerrarUltimo quita el más reciente', () => {
    const a = new Avisos();
    a.ok('uno'); a.error('dos');
    a.cerrarUltimo();
    expect(a.lista().map((x) => x.texto)).toEqual(['uno']);
  });
});

describe('texto del error de formulario', () => {
  it('con campos marcados cuenta los campos', () => {
    expect(textoErrorFormulario('Revisa los campos marcados.', 1)).toBe('No se guardó: revisa 1 campo.');
    expect(textoErrorFormulario('x', 3)).toBe('No se guardó: revisa 3 campos.');
  });
  it('sin campos usa el texto del sistema o uno neutro', () => {
    expect(textoErrorFormulario('No hay conexión.', 0)).toBe('No hay conexión.');
    expect(textoErrorFormulario('  ', 0)).toBe('No se pudo completar. Inténtalo de nuevo.');
    expect(textoErrorFormulario(null, 0)).toBe('No se pudo completar. Inténtalo de nuevo.');
  });
});
