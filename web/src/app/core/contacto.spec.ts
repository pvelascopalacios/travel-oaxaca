import { describe, expect, it } from 'vitest';
import { Categoria } from './modelos';
import { BorradorContacto, hayErroresContacto, mensajeFinal, municipioElegido, opcionesCategoria, validarContacto } from './contacto';

const b = (extra: Partial<BorradorContacto> = {}): BorradorContacto => ({ nombreNegocio: 'Mezcalería La Sierra', contactoNombre: '', telefono: '9515550123', correo: '', mensaje: '', municipioTexto: '', ...extra });
const cat = (id: string, nombre: string, hijas: Categoria[] = []): Categoria => ({ id, padreId: null, clave: id, nombre, hijas });

describe('contacto', () => {
  it('pide nombre y al menos un teléfono o correo', () => {
    expect(hayErroresContacto(validarContacto(b()))).toBe(false);
    expect(validarContacto(b({ nombreNegocio: '  ' })).nombreNegocio).toBe('ctNombreFalta');
    expect(validarContacto(b({ telefono: '', correo: '' })).contacto).toBe('ctContactoFalta');
    expect(hayErroresContacto(validarContacto(b({ telefono: '', correo: 'a@b.co' })))).toBe(false);
    expect(validarContacto(b({ mensaje: 'x'.repeat(501) })).mensaje).toBe('ctMensajeLargo');
  });

  it('agrupa las categorías con hijas', () => {
    const o = opcionesCategoria([cat('a', 'Dormir', [cat('a1', 'Hotel'), cat('a2', 'Hostal')]), cat('b', 'Otros')]);
    expect(o[0]).toEqual({ grupo: null, items: [{ id: 'b', nombre: 'Otros' }] });
    expect(o[1].grupo).toBe('Dormir');
    expect(o[1].items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(opcionesCategoria([])).toEqual([]);
  });

  it('reconoce el municipio sin acentos ni mayúsculas', () => {
    const l = [{ id: '1', nombre: 'Oaxaca de Juárez' }, { id: '2', nombre: 'Santiago Jamiltepec' }];
    expect(municipioElegido('oaxaca de juarez', l)?.id).toBe('1');
    expect(municipioElegido('  SANTIAGO JAMILTEPEC ', l)?.id).toBe('2');
    expect(municipioElegido('Tuxtepec', l)).toBeNull();
    expect(municipioElegido('', l)).toBeNull();
  });

  it('conserva un municipio no reconocido dentro del mensaje', () => {
    const m = { id: '1', nombre: 'Oaxaca de Juárez' };
    expect(mensajeFinal('', '', null)).toBeNull();
    expect(mensajeFinal('Hola', 'Oaxaca de Juárez', m)).toBe('Hola');
    expect(mensajeFinal('Hola', 'Tuxtepec', null)).toBe('Hola\nMunicipio: Tuxtepec');
    expect(mensajeFinal('', 'Tuxtepec', null)).toBe('Municipio: Tuxtepec');
    expect(mensajeFinal('x'.repeat(500), 'Tuxtepec', null)?.length).toBe(500);
  });
});
