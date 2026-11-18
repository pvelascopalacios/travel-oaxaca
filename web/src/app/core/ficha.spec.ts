import { describe, expect, it } from 'vitest';
import { bloqueDeFecha, calendarioUrl, calificacionVisible, enlaceDeContacto, filasHorario, urlSegura } from './ficha';

describe('ficha', () => {
  it('arma enlaces de contacto y descarta los que no sirven', () => {
    expect(enlaceDeContacto({ tipo: 'whatsapp', valor: '+52 951 123 4567', esPrincipal: true })?.href).toBe('https://wa.me/529511234567');
    expect(enlaceDeContacto({ tipo: 'telefono', valor: '951 123 4567', esPrincipal: true })?.href).toBe('tel:9511234567');
    expect(enlaceDeContacto({ tipo: 'web', valor: 'casaazul.mx', esPrincipal: true })?.href).toBe('https://casaazul.mx');
    expect(enlaceDeContacto({ tipo: 'instagram', valor: '@casaazul', esPrincipal: false })?.href).toBe('https://www.instagram.com/casaazul');
    expect(enlaceDeContacto({ tipo: 'facebook', valor: 'javascript:alert(1)', esPrincipal: false })).toBeNull();
    expect(enlaceDeContacto({ tipo: 'correo', valor: 'no-es-correo', esPrincipal: false })).toBeNull();
  });

  it('solo acepta direcciones http(s)', () => {
    expect(urlSegura('javascript:alert(1)')).toBeNull();
    expect(urlSegura('https://a.mx/x')).toBe('https://a.mx/x');
  });

  it('ordena el horario con lunes primero y marca los días sin datos como cerrados', () => {
    const f = filasHorario([
      { diaSemana: 6, abre: '09:00:00', cierra: '14:00:00', cerrado: false },
      { diaSemana: 6, abre: '17:00:00', cierra: '21:00:00', cerrado: false },
      { diaSemana: 0, abre: null, cierra: null, cerrado: true },
    ]);
    expect(f[0].dia).toBe(1);
    expect(f[0].cerrado).toBe(true);
    expect(f[5].tramos).toEqual(['09:00–14:00', '17:00–21:00']);
    expect(f[6].cerrado).toBe(true);
  });

  it('muestra la calificación solo con 3 reseñas o más', () => {
    expect(calificacionVisible(4.6, 2)).toBeNull();
    expect(calificacionVisible(4.6, 3)).toBe('4.6');
    expect(calificacionVisible(null, 10)).toBeNull();
  });

  it('el enlace de calendario termina un día después (fecha final exclusiva)', () => {
    expect(calendarioUrl('Fiesta', '2026-12-02', '2026-12-03', 'Oaxaca')).toContain('dates=20261202%2F20261204');
  });
});

describe('bloqueDeFecha', () => {
  const mes = (iso: string) => ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'][Number(iso.slice(5, 7)) - 1];
  it('un solo día', () => expect(bloqueDeFecha('2026-11-05', null, mes)).toEqual({ dias: '5', mes: 'NOV' }));
  it('mismo día de inicio y fin cuenta como un día', () => expect(bloqueDeFecha('2026-11-05', '2026-11-05', mes)).toEqual({ dias: '5', mes: 'NOV' }));
  it('varios días del mismo mes', () => expect(bloqueDeFecha('2026-11-20', '2026-11-22', mes)).toEqual({ dias: '20–22', mes: 'NOV' }));
  it('cruza de mes', () => expect(bloqueDeFecha('2026-11-30', '2026-12-02', mes)).toEqual({ dias: '30–2', mes: 'NOV–DIC' }));
  it('quita el punto del mes abreviado', () => expect(bloqueDeFecha('2026-09-01', null, mes).mes).toBe('SEPT'));
});
