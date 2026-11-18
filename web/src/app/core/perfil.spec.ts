import { describe, expect, it } from 'vitest';
import { Consentimiento, SesionActiva, SolicitudPrivacidad } from './modelos';
import {
  claseEstado, consentimientoVigente, fechaConsentimiento, hayErrores, iniciales, normalizarTelefono, ordenarSesiones, ordenarSolicitudes,
  otrasSesiones, plataformaClave, solicitudAbierta, validarClave, validarPerfil,
} from './perfil';

const ses = (id: string, actual: boolean, creadoEn: string): SesionActiva => ({ id, plataforma: 'web', versionApp: null, creadoEn, expiraEn: '2027-01-01T00:00:00Z', actual });
const con = (tipo: Consentimiento['tipo'], aceptado: boolean, fecha: string): Consentimiento => ({ tipo, versionTexto: '1', aceptado, fecha });
const sol = (id: string, tipo: SolicitudPrivacidad['tipo'], estado: SolicitudPrivacidad['estado'], creadoEn: string): SolicitudPrivacidad => ({ id, tipo, estado, detalle: null, resueltaEn: null, creadoEn });

describe('perfil', () => {
  it('normaliza el teléfono', () => {
    expect(normalizarTelefono('+52 954 123-4567')).toBe('+529541234567');
    expect(normalizarTelefono('  ')).toBeNull();
  });

  it('valida nombre y teléfono; el teléfono es opcional', () => {
    expect(validarPerfil('María', '')).toEqual({});
    expect(validarPerfil('María', '+52 954 123 4567')).toEqual({});
    expect(validarPerfil('  ', '')).toEqual({ nombre: 'perfilNombreVacio' });
    expect(validarPerfil('x'.repeat(121), '')).toEqual({ nombre: 'perfilNombreLargo' });
    expect(validarPerfil('María', '9541234567')).toEqual({ telefono: 'perfilTelefonoInvalido' });
    expect(validarPerfil('María', '+0123456789')).toEqual({ telefono: 'perfilTelefonoInvalido' });
  });

  it('valida el cambio de contraseña', () => {
    expect(validarClave('vieja123', 'nueva1234', 'nueva1234')).toEqual({});
    expect(validarClave('', '', '')).toEqual({ actual: 'perfilClaveActualVacia', nueva: 'perfilClaveNuevaVacia' });
    expect(validarClave('abc', 'abc', 'abc').nueva).toBe('perfilClaveIgual');
    expect(validarClave('abc', 'nueva1234', 'otra').repetir).toBe('perfilClaveNoCoincide');
    expect(validarClave('abc', 'x'.repeat(129), 'x'.repeat(129)).nueva).toBe('perfilClaveLarga');
    expect(hayErrores({})).toBe(false);
    expect(hayErrores({ a: 1 })).toBe(true);
  });

  it('saca las iniciales', () => {
    expect(iniciales('María García López')).toBe('ML');
    expect(iniciales('rosa')).toBe('R');
    expect(iniciales('   ')).toBe('?');
  });

  it('ordena las sesiones con la actual primero', () => {
    const l = ordenarSesiones([ses('a', false, '2026-10-01T00:00:00Z'), ses('b', true, '2026-09-01T00:00:00Z'), ses('c', false, '2026-11-01T00:00:00Z')]);
    expect(l.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(otrasSesiones(l).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('nombra la plataforma', () => {
    expect(plataformaClave('Android')).toBe('perfilPlataformaAndroid');
    expect(plataformaClave('ios')).toBe('perfilPlataformaIos');
    expect(plataformaClave('web')).toBe('perfilPlataformaWeb');
    expect(plataformaClave('tv')).toBe('perfilPlataformaOtra');
  });

  it('toma el consentimiento más reciente de cada tipo', () => {
    const l = [con('analitica', true, '2026-01-01T00:00:00Z'), con('analitica', false, '2026-03-01T00:00:00Z'), con('marketing', true, '2026-02-01T00:00:00Z'), con('privacidad', true, '2026-01-01T00:00:00Z')];
    expect(consentimientoVigente(l, 'analitica')).toBe(false);
    expect(consentimientoVigente(l, 'marketing')).toBe(true);
    expect(consentimientoVigente([], 'marketing')).toBe(false);
    expect(fechaConsentimiento(l, 'analitica')).toBe('2026-03-01T00:00:00Z');
    expect(fechaConsentimiento([], 'analitica')).toBeNull();
  });

  it('ordena solicitudes y detecta las abiertas', () => {
    const l = [sol('1', 'acceso', 'resuelta', '2026-09-01T00:00:00Z'), sol('2', 'acceso', 'en_proceso', '2026-11-02T00:00:00Z'), sol('3', 'cancelacion', 'rechazada', '2026-10-01T00:00:00Z')];
    expect(ordenarSolicitudes(l).map((s) => s.id)).toEqual(['2', '3', '1']);
    expect(solicitudAbierta(l, 'acceso')).toBe(true);
    expect(solicitudAbierta(l, 'cancelacion')).toBe(false);
    expect(solicitudAbierta(l, 'oposicion')).toBe(false);
    expect(claseEstado('resuelta')).toBe('ok');
    expect(claseEstado('rechazada')).toBe('no');
  });
});
