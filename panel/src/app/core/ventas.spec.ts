import { describe, expect, it } from 'vitest';
import {
  afiliadoParaApi, completarDias, errorDeAfiliado, errorDeArchivoCsv, errorDeDescarte, errorDeInteraccion, errorDeProspecto, estaAbierta, estadosSiguientes, faltaParaConvertir,
  formAfiliadoVacio, formProspectoVacio, hayErroresSinMostrar, interaccionParaApi, planDeAplicar, prospectoParaApi, puedeEliminar, resumenClics, tiposImportables,
} from './ventas';

describe('prospectos', () => {
  it('los estados siguientes no incluyen el actual ni convertido', () => {
    expect(estadosSiguientes('nuevo').map((e) => e.clave)).toEqual(['contactado', 'interesado', 'en_alta', 'descartado']);
    expect(estadosSiguientes('descartado').map((e) => e.clave)).toEqual(['nuevo', 'contactado', 'interesado', 'en_alta']);
    expect(estadosSiguientes('convertido')).toEqual([]);
  });
  it('valida el formulario', () => {
    const f = formProspectoVacio();
    expect(errorDeProspecto(f)['nombreNegocio']).toBeDefined();
    f.nombreNegocio = 'Fonda Tía Lola';
    f.correo = 'mal';
    expect(errorDeProspecto(f)['correo']).toBeDefined();
    f.correo = 'lola@correo.com';
    expect(errorDeProspecto(f)).toEqual({});
  });
  it('manda null en lo vacío', () => {
    const f = formProspectoVacio();
    f.nombreNegocio = '  Fonda  ';
    const b = prospectoParaApi(f);
    expect(b.nombreNegocio).toBe('Fonda');
    expect(b.telefono).toBeNull();
    expect(b.categoriaId).toBeNull();
    expect(b.origen).toBe('otro');
  });
  it('la próxima acción no puede estar en el pasado', () => {
    expect(errorDeInteraccion({ tipo: 'llamada', cuando: '', resultado: '', notas: '', proximaAccionEn: '2027-01-01' }, '2027-01-02')['proximaAccionEn']).toBeDefined();
    expect(errorDeInteraccion({ tipo: 'llamada', cuando: '', resultado: '', notas: '', proximaAccionEn: '2027-01-02' }, '2027-01-02')).toEqual({});
    expect(interaccionParaApi({ tipo: 'nota', cuando: '', resultado: '', notas: 'x', proximaAccionEn: '' }).ocurrioEn).toBeNull();
  });
  it('descartar pide motivo', () => {
    expect(errorDeDescarte('')).toBeDefined();
    expect(errorDeDescarte('a'.repeat(501))).toContain('500');
    expect(errorDeDescarte('Cerró')).toBeNull();
  });
  it('convertir necesita categoría y municipio (propios o elegidos)', () => {
    expect(Object.keys(faltaParaConvertir({ categoriaId: null, municipioId: null }, '', ''))).toEqual(['categoriaId', 'municipioId']);
    expect(faltaParaConvertir({ categoriaId: 'c', municipioId: null }, '', 'm')).toEqual({});
  });
  it('un convertido no se elimina', () => {
    expect(puedeEliminar({ estado: 'convertido', negocioId: 'n' })).toBe(false);
    expect(puedeEliminar({ estado: 'nuevo', negocioId: null })).toBe(true);
  });
});

describe('importaciones', () => {
  it('cada rol importa solo lo suyo', () => {
    expect(tiposImportables(['ventas']).map((t) => t.clave)).toEqual(['prospectos']);
    expect(tiposImportables(['editor']).map((t) => t.clave)).toEqual(['negocios', 'lugares', 'eventos']);
    expect(tiposImportables(['ROLE_ADMIN']).length).toBe(4);
    expect(tiposImportables([])).toEqual([]);
  });
  it('valida el archivo', () => {
    expect(errorDeArchivoCsv({ name: 'a.xlsx', size: 10 })).toContain('.csv');
    expect(errorDeArchivoCsv({ name: 'a.csv', size: 0 })).toContain('vacío');
    expect(errorDeArchivoCsv({ name: 'a.CSV', size: 3 * 1024 * 1024 })).toContain('2 MB');
    expect(errorDeArchivoCsv({ name: 'a.csv', size: 100 })).toBeNull();
  });
  it('plan de aplicar', () => {
    expect(planDeAplicar({ filasOk: 0, filasError: 3 }).puede).toBe(false);
    expect(planDeAplicar({ filasOk: 114, filasError: 6 })).toMatchObject({ puede: true, pideConfirmar: true });
    expect(planDeAplicar({ filasOk: 10, filasError: 0 })).toMatchObject({ puede: true, pideConfirmar: false });
  });
  it('estado abierto y errores sin mostrar', () => {
    expect(estaAbierta({ estado: 'validada' })).toBe(true);
    expect(estaAbierta({ estado: 'aplicada' })).toBe(false);
    expect(hayErroresSinMostrar({ filasError: 600 }, new Array(500).fill({ fila: 1, campo: null, valor: null, problema: 'x' }))).toBe(true);
    expect(hayErroresSinMostrar({ filasError: 3 }, [])).toBe(true);
  });
});

describe('afiliados', () => {
  it('valida código, destino, socio y comisión', () => {
    const f = formAfiliadoVacio();
    expect(Object.keys(errorDeAfiliado(f))).toEqual(['codigo', 'destinoUrl', 'socio']);
    f.codigo = 'Hotel Sol'; f.destinoUrl = 'ftp://x'; f.socio = 'S'; f.comisionPct = '120';
    expect(Object.keys(errorDeAfiliado(f))).toEqual(['codigo', 'destinoUrl', 'comisionPct']);
    f.codigo = 'hotel-sol'; f.destinoUrl = 'https://socio.example/oaxaca'; f.comisionPct = '8,5';
    expect(errorDeAfiliado(f)).toEqual({});
    expect(afiliadoParaApi(f).comisionPct).toBe(8.5);
    expect(afiliadoParaApi({ ...f, comisionPct: '' }).comisionPct).toBeNull();
  });
  it('resumen y relleno de días', () => {
    const l = [{ dia: '2027-01-01', clics: 3 }, { dia: '2027-01-03', clics: 9 }];
    expect(resumenClics(l)).toEqual({ total: 12, maximo: 9, diaMaximo: '2027-01-03' });
    expect(completarDias(l, '2027-01-01', '2027-01-04').map((c) => c.clics)).toEqual([3, 0, 9, 0]);
  });
});
