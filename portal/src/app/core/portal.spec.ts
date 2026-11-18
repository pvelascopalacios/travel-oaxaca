import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { Categoria } from './modelos';
import { accionesConResultado, cambio, cambioPuntos, categoriasElegibles, destinoSeguro, estadoInfo, flecha, leerError, nombreCategoria, resumirReporte, trazar } from './portal';

const cat = (id: string, clave: string, nombre: string, hijas: Categoria[] = []): Categoria => ({ id, padreId: null, clave, nombre, hijas });

describe('portal', () => {
  it('cambio y flechas', () => {
    expect(cambio(112, 100)).toBe(12);
    expect(cambio(50, 100)).toBe(-50);
    expect(cambio(5, 0)).toBeNull();
    expect(cambio(5, null)).toBeNull();
    expect(cambioPuntos(7.5, 7.8)).toBe(-0.3);
    expect(cambioPuntos(null, 7.8)).toBeNull();
    expect(flecha(12)).toBe('▲ 12');
    expect(flecha(-3)).toBe('▼ 3');
    expect(flecha(0)).toBe('0');
  });

  it('estados conocidos y desconocidos', () => {
    expect(estadoInfo('en_revision').texto).toBe('En revisión');
    expect(estadoInfo('raro').texto).toBe('raro');
  });

  it('categorías elegibles: solo las hojas, con su grupo', () => {
    const arbol = [cat('1', 'artesanias', 'Artesanías', [cat('2', 'barro', 'Barro negro')]), cat('3', 'hotel', 'Hotel')];
    const o = categoriasElegibles(arbol);
    expect(o.map((x) => x.etiqueta)).toEqual(['Artesanías › Barro negro', 'Hotel']);
    expect(nombreCategoria(o, 'barro')).toBe('Barro negro');
    expect(nombreCategoria(o, 'tour_dia')).toBe('Tour dia');
  });

  it('destino seguro', () => {
    expect(destinoSeguro('/negocios/abc')).toBe('/negocios/abc');
    expect(destinoSeguro('//otro.com')).toBeNull();
    expect(destinoSeguro('https://otro.com')).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
  });

  it('errores de la API', () => {
    const e = new HttpErrorResponse({ status: 400, error: { mensajes: ['Revisa los datos.'], errores: { correo: 'Mal.' } } });
    expect(leerError(e)).toEqual({ general: 'Revisa los datos.', campos: { correo: 'Mal.' } });
    expect(leerError(new HttpErrorResponse({ status: 0 })).general).toContain('conexión');
  });

  it('trazo de la serie', () => {
    expect(trazar([{ dia: '2026-11-01', vistas: 1, contactos: 0 }], 600, 150)).toBeNull();
    const t = trazar([{ dia: '2026-11-01', vistas: 10, contactos: 1 }, { dia: '2026-11-02', vistas: 20, contactos: 2 }], 600, 150)!;
    expect(t.maximo).toBe(20);
    expect(t.vistas.split(' ')).toHaveLength(2);
    expect(t.desde).toBe('2026-11-01');
  });

  it('acciones: sin vistas ni ceros, de mayor a menor', () => {
    const m = { porTipo: [{ tipo: 'vista_ficha', total: 99 }, { tipo: 'llamada', total: 3 }, { tipo: 'toque_whatsapp', total: 9 }, { tipo: 'guardado', total: 0 }] } as never;
    expect(accionesConResultado(m).map((a) => a.tipo)).toEqual(['toque_whatsapp', 'llamada']);
  });

  it('reporte mensual', () => {
    const r = resumirReporte({ id: '1', anio: 2026, mes: 10, generadoEn: '2026-11-01T00:00:00Z', enviadoEn: null, datos: { contactos_totales: 10, por_tipo: { vista_ficha: 200, llamada: 4 }, por_origen: { app: { contactos: 6, vistas: 120, pct_contactos: 5 } } } });
    expect(r.vistas).toBe(200);
    expect(r.tasa).toBe(5);
    expect(r.origenes[0].clave).toBe('app');
  });
});
