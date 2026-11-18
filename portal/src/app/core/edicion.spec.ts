import { describe, expect, it } from 'vitest';
import { Categoria } from './modelos';
import {
  aNumero, camposDeRaiz, coordenadaValida, copiarATodos, diasDesdeHorarios, errorDeContacto, errorDeExcepciones, errorDeHorarios,
  excepcionesParaApi, horariosParaApi, limpiarAtributos, normalizarTelefono, planDeContactos, raizDeCategoria,
} from './edicion';

const cat = (id: string, clave: string, hijas: Categoria[] = []): Categoria => ({ id, padreId: null, clave, nombre: clave, hijas });

describe('edición de la ficha', () => {
  it('raíz de una categoría', () => {
    const arbol = [cat('1', 'comida', [cat('2', 'fonda'), cat('3', 'cafe')]), cat('4', 'tours')];
    expect(raizDeCategoria(arbol, '2')).toBe('comida');
    expect(raizDeCategoria(arbol, '4')).toBe('tours');
    expect(raizDeCategoria(arbol, 'x')).toBeNull();
  });

  it('atributos: solo las claves del tipo y sin vacíos', () => {
    expect(camposDeRaiz('comida').map((c) => c.clave)).toContain('tipoCocina');
    expect(camposDeRaiz('otra')).toEqual([]);
    const l = limpiarAtributos('comida', { tipoCocina: ['Oaxaqueña'], rangoPlatillo: '  ', menuUrl: ' https://a.mx ', dificultad: 'alta', platillosTipicos: [] });
    expect(l).toEqual({ tipoCocina: ['Oaxaqueña'], menuUrl: 'https://a.mx' });
    expect(limpiarAtributos('hospedaje', { aceptaNinos: false, numeroHabitaciones: 8 })).toEqual({ aceptaNinos: false, numeroHabitaciones: 8 });
  });

  it('números con coma', () => {
    expect(aNumero('2,5')).toBe(2.5);
    expect(aNumero(' ')).toBeNull();
    expect(aNumero('abc')).toBeNull();
    expect(aNumero(90)).toBe(90);
  });

  it('coordenadas', () => {
    expect(coordenadaValida(null, null).ok).toBe(true);
    expect(coordenadaValida(17.03, null).ok).toBe(false);
    expect(coordenadaValida(17.03, -96.75).ok).toBe(true);
    expect(coordenadaValida(-96.75, 17.03).ok).toBe(false);
    expect(coordenadaValida(40, -3).ok).toBe(false);
  });

  it('teléfonos con lada', () => {
    expect(normalizarTelefono('951 123 4567')).toBe('+529511231234'.slice(0, 3) + '9511234567');
    expect(normalizarTelefono('+52 951 123 4567')).toBe('+529511234567');
    expect(normalizarTelefono('52 951 123 4567')).toBe('+529511234567');
    expect(normalizarTelefono('521 951 123 4567')).toBe('+529511234567');
    expect(normalizarTelefono('123')).toBe('123');
  });

  it('contactos: formato por tipo', () => {
    expect(errorDeContacto('whatsapp', '+529511234567')).toBeNull();
    expect(errorDeContacto('whatsapp', '951 123 4567')).toContain('lada');
    expect(errorDeContacto('correo', 'a@b.mx')).toBeNull();
    expect(errorDeContacto('instagram', '@flor')).toContain('https://');
    expect(errorDeContacto('instagram', 'https://instagram.com/flor')).toBeNull();
    expect(errorDeContacto('web', '')).toContain('Escribe');
  });

  it('plan de contactos: crear, cambiar y quitar', () => {
    const actuales = [
      { id: 'a', sucursalId: null, tipo: 'whatsapp', valor: '+529511234567', esPrincipal: true },
      { id: 'b', sucursalId: null, tipo: 'correo', valor: 'x@y.mx', esPrincipal: true },
      { id: 'c', sucursalId: null, tipo: 'web', valor: 'https://a.mx', esPrincipal: true },
    ];
    const p = planDeContactos(actuales, [
      { id: 'a', tipo: 'whatsapp', valor: '+529511234567', esPrincipal: true },
      { id: 'b', tipo: 'correo', valor: 'nuevo@y.mx', esPrincipal: true },
      { id: null, tipo: 'telefono', valor: '+529510000000', esPrincipal: false },
    ]);
    expect(p.crear).toHaveLength(1);
    expect(p.cambiar.map((x) => x.id)).toEqual(['b']);
    expect(p.quitar).toEqual(['c']);
  });

  it('horarios: de la API a siete días y de vuelta', () => {
    const dias = diasDesdeHorarios([
      { diaSemana: 1, abre: '08:00:00', cierra: '22:00:00', cerrado: false },
      { diaSemana: 6, abre: '09:00', cierra: '14:00', cerrado: false },
      { diaSemana: 6, abre: '17:00', cierra: '21:00', cerrado: false },
      { diaSemana: 0, abre: null, cierra: null, cerrado: true },
    ]);
    expect(dias.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(dias[0].franjas).toEqual([{ abre: '08:00', cierra: '22:00' }]);
    expect(dias[5].franjas).toHaveLength(2);
    expect(dias[6].cerrado).toBe(true);
    const api = horariosParaApi(dias);
    expect(api).toHaveLength(4);
    expect(api.at(-1)).toEqual({ diaSemana: 0, abre: null, cierra: null, cerrado: true });
    expect(errorDeHorarios(dias)).toBeNull();
  });

  it('horarios: errores', () => {
    const base = diasDesdeHorarios([]);
    expect(errorDeHorarios(base)).toBeNull();
    base[0].franjas = [{ abre: '08:00', cierra: '' }];
    expect(errorDeHorarios(base)).toContain('Lunes');
    base[0].franjas = [{ abre: '08:00', cierra: '08:00' }];
    expect(errorDeHorarios(base)).toContain('misma hora');
    base[0].franjas = Array(4).fill({ abre: '08:00', cierra: '09:00' });
    expect(errorDeHorarios(base)).toContain('máximo 3');
  });

  it('copiar un día a todos', () => {
    const d = diasDesdeHorarios([{ diaSemana: 1, abre: '08:00', cierra: '22:00', cerrado: false }]);
    const c = copiarATodos(d, 1);
    expect(c.every((x) => x.franjas.length === 1 && x.franjas[0].abre === '08:00')).toBe(true);
    c[1].franjas[0].abre = '10:00';
    expect(c[0].franjas[0].abre).toBe('08:00');
  });

  it('fechas especiales', () => {
    const ok = { fecha: '2026-12-25', cerrado: true, abre: '', cierra: '', nota: ' Navidad ' };
    expect(errorDeExcepciones([ok], '2026-11-13')).toBeNull();
    expect(errorDeExcepciones([ok, ok], '2026-11-13')).toContain('misma fecha');
    expect(errorDeExcepciones([{ ...ok, fecha: '2026-11-01' }], '2026-11-13')).toContain('hoy');
    expect(errorDeExcepciones([{ ...ok, cerrado: false }], '2026-11-13')).toContain('horario');
    expect(excepcionesParaApi([ok])).toEqual([{ fecha: '2026-12-25', cerrado: true, abre: null, cierra: null, nota: 'Navidad' }]);
  });
});
