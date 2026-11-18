import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { cambio, destinoSeguro, leerError, mesAnterior, resumirReporte } from './cuenta';
import { ReporteMensual } from './modelos';

const rep = (anio: number, mes: number, datos: Record<string, unknown>): ReporteMensual => ({ id: `${anio}-${mes}`, anio, mes, generadoEn: '2026-11-01T06:00:00Z', enviadoEn: null, datos });

describe('cuenta', () => {
  it('solo regresa a páginas del propio sitio', () => {
    expect(destinoSeguro('/es/negocio/hotel-casa-azul')).toBe('/es/negocio/hotel-casa-azul');
    expect(destinoSeguro('/en/guardados?x=1')).toBe('/en/guardados?x=1');
    expect(destinoSeguro('https://malo.com')).toBeNull();
    expect(destinoSeguro('//malo.com/es')).toBeNull();
    expect(destinoSeguro('/otro/ruta')).toBeNull();
    expect(destinoSeguro('javascript:alert(1)')).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
  });

  it('lee el mensaje y los errores por campo que manda la API', () => {
    const e = new HttpErrorResponse({ status: 400, error: { ok: false, mensajes: ['Revisa los datos.'], errores: { correo: 'Escribe un correo válido.' } } });
    expect(leerError(e, 'x')).toEqual({ general: 'Revisa los datos.', campos: { correo: 'Escribe un correo válido.' } });
    expect(leerError(new HttpErrorResponse({ status: 0 }), 'sin red').general).toBe('sin red');
  });

  it('resume el reporte: vistas de por_tipo, tasa y orígenes por contactos', () => {
    const r = resumirReporte(rep(2026, 10, {
      contactos_totales: 96,
      por_tipo: { vista_ficha: 1284, toque_whatsapp: 52, llamada: 21, otro_raro: 3 },
      por_origen: { enlace_directo: { contactos: 16, vistas: 194, pct_contactos: 16.7 }, app: { contactos: 51, vistas: 702, pct_contactos: 53.1 } },
    }));
    expect(r.vistas).toBe(1284);
    expect(r.contactos).toBe(96);
    expect(r.tasa).toBe(7.5);
    expect(r.acciones.map((a) => a.tipo)).toEqual(['toque_whatsapp', 'llamada']);
    expect(r.origenes[0].clave).toBe('app');
  });

  it('si faltan datos no truena y la tasa queda vacía', () => {
    const r = resumirReporte(rep(2026, 1, {}));
    expect(r.vistas).toBe(0);
    expect(r.tasa).toBeNull();
    expect(r.origenes).toEqual([]);
  });

  it('compara con el mes anterior solo si existe', () => {
    const lista = [rep(2026, 10, {}), rep(2026, 9, {}), rep(2025, 12, {})];
    expect(mesAnterior(lista, lista[0])?.mes).toBe(9);
    expect(mesAnterior(lista, rep(2026, 1, {}))?.anio).toBe(2025);
    expect(mesAnterior(lista, rep(2026, 4, {}))).toBeNull();
    expect(cambio(120, 100)).toBe(20);
    expect(cambio(80, 100)).toBe(-20);
    expect(cambio(5, 0)).toBeNull();
    expect(cambio(5, null)).toBeNull();
  });
});
