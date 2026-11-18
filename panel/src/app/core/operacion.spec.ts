import { describe, expect, it } from 'vitest';
import {
  agruparConfig, barraCalendario, campanaParaApi, diferencias, errorDeCampana, errorDeEspacio, errorDePatrocinio, errorDePlantilla, espacioParaApi, filasCalendario, formCampanaVacio, formEspacioVacio,
  formPatrocinioVacio, grupoConfig, ocupacion, patrocinioParaApi, puedeCancelarPatrocinio, puedeReintentar, sinContactoAlerta, sumaDias, tasaTexto, valorParaApi, variablesEnUso,
} from './operacion';
import { Patrocinio } from './modelos';

const pat = (id: string, esp: string, i: string, f: string, estado = 'activo'): Patrocinio => ({ id, espacioId: esp, espacioClave: 'destacado_explorar', negocioId: 'n', negocioNombre: 'N' + id, inicio: i, fin: f, estado, precio: 1, moneda: 'MXN', pagoId: null });

describe('patrocinios', () => {
  it('valida el formulario', () => {
    const e = errorDePatrocinio(formPatrocinioVacio());
    expect(Object.keys(e).sort()).toEqual(['espacioId', 'fin', 'inicio', 'negocioId', 'precio']);
    const f = { ...formPatrocinioVacio('2026-12-10'), espacioId: 'e', negocioId: 'n', fin: '2026-12-01', precio: '-3' };
    expect(errorDePatrocinio(f)['fin']).toContain('posterior');
    expect(errorDePatrocinio(f)['precio']).toContain('0 en adelante');
  });
  it('arma el cuerpo con coma decimal y pago opcional', () => {
    const f = { ...formPatrocinioVacio('2026-12-01'), espacioId: 'e', negocioId: 'n', fin: '2026-12-31', precio: '1200,50', cupon: ' ', conPago: true, referencia: ' R1 ', pagado: true };
    expect(patrocinioParaApi(f)).toEqual({ espacioId: 'e', negocioId: 'n', inicio: '2026-12-01', fin: '2026-12-31', precio: 1200.5, cupon: null, pago: { metodo: 'transferencia', referencia: 'R1', pagado: true } });
    expect(patrocinioParaApi({ ...f, conPago: false }).pago).toBeNull();
  });
  it('solo cancela programados y activos', () => {
    expect(puedeCancelarPatrocinio({ estado: 'programado' })).toBe(true);
    expect(puedeCancelarPatrocinio({ estado: 'cancelado' })).toBe(false);
  });
  it('espacio: cupo entero de 1 en adelante', () => {
    expect(errorDeEspacio({ ...formEspacioVacio(), maxSimultaneos: '0' })['maxSimultaneos']).toBeTruthy();
    expect(errorDeEspacio({ ...formEspacioVacio(), maxSimultaneos: '2.5' })['maxSimultaneos']).toBeTruthy();
    expect(errorDeEspacio(formEspacioVacio())).toEqual({});
    expect(espacioParaApi({ ...formEspacioVacio(), maxSimultaneos: '3', regionId: 'r' })).toMatchObject({ maxSimultaneos: 3, regionId: 'r', categoriaId: null });
  });
  it('calcula la barra del calendario y la recorta', () => {
    expect(barraCalendario({ inicio: '2026-12-01', fin: '2026-12-10' }, '2026-12-01', '2026-12-20')).toEqual({ izq: 0, ancho: 50 });
    expect(barraCalendario({ inicio: '2026-11-20', fin: '2026-12-05' }, '2026-12-01', '2026-12-10')?.izq).toBe(0);
    expect(barraCalendario({ inicio: '2027-01-01', fin: '2027-01-05' }, '2026-12-01', '2026-12-10')).toBeNull();
  });
  it('reparte en carriles los que se cruzan', () => {
    const f = filasCalendario([pat('1', 'e1', '2026-12-01', '2026-12-10'), pat('2', 'e1', '2026-12-05', '2026-12-15'), pat('3', 'e1', '2026-12-11', '2026-12-20')], '2026-12-01', '2026-12-31');
    expect(f).toHaveLength(1);
    expect(f[0].items.map((x) => x.carril)).toEqual([0, 1, 0]);
    expect(f[0].carriles).toBe(2);
  });
  it('cuenta la ocupación de un día y suma días', () => {
    const l = [pat('1', 'e1', '2026-12-01', '2026-12-10'), pat('2', 'e1', '2026-12-05', '2026-12-15', 'cancelado')];
    expect(ocupacion(l, 'e1', '2026-12-06')).toBe(1);
    expect(sumaDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('métricas y campañas', () => {
  it('formatea la tasa y la alerta', () => {
    expect(tasaTexto(0.125)).toBe('12.5 %');
    expect(tasaTexto(null)).toBe('—');
    expect(sinContactoAlerta(20, 100)).toBe(true);
    expect(sinContactoAlerta(20, 0)).toBe(false);
  });
  it('valida la campaña; el código solo al crear', () => {
    expect(Object.keys(errorDeCampana(formCampanaVacio(), true)).sort()).toEqual(['codigo', 'nombre', 'origen']);
    expect(errorDeCampana({ ...formCampanaVacio(), origen: 'qr', nombre: 'x' }, false)).toEqual({});
    expect(errorDeCampana({ origen: 'qr', codigo: 'Mal Codigo', nombre: 'x', inicio: '', fin: '' }, true)['codigo']).toContain('minúsculas');
    expect(errorDeCampana({ origen: 'qr', codigo: 'ok', nombre: 'x', inicio: '2026-02-02', fin: '2026-02-01' }, true)['fin']).toBeTruthy();
    expect(campanaParaApi({ origen: 'qr', codigo: ' ok ', nombre: ' N ', inicio: '', fin: '' }, true)).toEqual({ origen: 'qr', codigo: 'ok', nombre: 'N', inicio: null, fin: null });
    expect('codigo' in campanaParaApi({ origen: 'qr', codigo: 'ok', nombre: 'N', inicio: '', fin: '' }, false)).toBe(false);
  });
});

describe('auditoría', () => {
  it('muestra solo lo que cambió', () => {
    expect(diferencias({ antes: { estado: 'borrador', nombre: 'A' }, despues: { estado: 'publicado', nombre: 'A' } })).toEqual([{ campo: 'estado', antes: 'borrador', despues: 'publicado' }]);
    expect(diferencias({ antes: null, despues: { a: 1 } })).toEqual([{ campo: 'a', antes: '—', despues: '1' }]);
    expect(diferencias({ antes: { a: { x: 1 } }, despues: null })[0].antes).toBe('{"x":1}');
  });
});

describe('configuración', () => {
  it('valida enteros con rango', () => {
    const c = { tipo: 'entero', minimo: 0, maximo: 365 };
    expect(valorParaApi(c, '30')).toEqual({ valor: 30 });
    expect(valorParaApi(c, '3.5')).toEqual({ error: 'Escribe un número entero.' });
    expect(valorParaApi(c, '400')).toEqual({ error: 'No puede ser mayor que 365.' });
    expect(valorParaApi(c, '-1')).toEqual({ error: 'No puede ser menor que 0.' });
  });
  it('booleano, texto y JSON', () => {
    expect(valorParaApi({ tipo: 'booleano', minimo: null, maximo: null }, 'true')).toEqual({ valor: true });
    expect(valorParaApi({ tipo: 'texto', minimo: null, maximo: null }, '  ')).toEqual({ error: 'Escribe un texto.' });
    expect(valorParaApi({ tipo: 'json', minimo: null, maximo: null }, '{"a":1}')).toEqual({ valor: { a: 1 } });
    expect(valorParaApi({ tipo: 'json', minimo: null, maximo: null }, '5')).toHaveProperty('error');
    expect(valorParaApi({ tipo: 'json', minimo: null, maximo: null }, '{mal')).toEqual({ error: 'El JSON no es válido.' });
  });
  it('agrupa por tema y manda lo desconocido a Otros', () => {
    expect(grupoConfig('dias_gracia')).toBe('comercial');
    const g = agruparConfig([{ clave: 'dias_gracia' }, { clave: 'rara' }, { clave: 'reservas_activas' }] as never);
    expect(g.map((x) => x.clave)).toEqual(['comercial', 'apps', 'otros']);
  });
});

describe('plantillas y cola', () => {
  const p = { canal: 'correo', variables: ['nombre', 'promocion'] };
  it('detecta variables', () => {
    expect(variablesEnUso('Hola {{nombre}}', '{{ promocion }} {{nombre}}').sort()).toEqual(['nombre', 'promocion']);
  });
  it('valida asunto, cuerpo y variables permitidas', () => {
    expect(errorDePlantilla(p, '', 'Hola')['asunto']).toBeTruthy();
    expect(errorDePlantilla({ canal: 'push', variables: [] }, '', 'Hola')).toEqual({});
    expect(errorDePlantilla(p, 'A', '')['cuerpo']).toBeTruthy();
    expect(errorDePlantilla(p, 'A', 'Hola {{otra}}')['cuerpo']).toContain('{{otra}}');
    expect(errorDePlantilla(p, 'A', 'Hola {{ nombre }}')['cuerpo']).toContain('sin espacios');
    expect(errorDePlantilla(p, 'A', 'Hola {{nombre}}')).toEqual({});
  });
  it('solo reintenta las fallidas', () => {
    expect(puedeReintentar({ estado: 'fallida' })).toBe(true);
    expect(puedeReintentar({ estado: 'enviada' })).toBe(false);
  });
});
