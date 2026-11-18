import { describe, expect, it } from 'vitest';
import { Categoria } from './modelos';
import { categoriasPlanas, errorDeMotivo, esperaTexto, filasDeCambios, MOTIVO_FICHA, MOTIVO_PROMOCION, nombreCategoria, normalizarRol, resultadoInfo, rolPrincipal, tieneAlgunRol, urgenciaInfo, valorPromo, destinoSeguro } from './panel';

const arbol: Categoria[] = [
  { id: 'c1', padreId: null, clave: 'hospedaje', nombre: 'Dónde dormir', hijas: [{ id: 'c2', padreId: 'c1', clave: 'hotel', nombre: 'Hotel', hijas: [] }] },
  { id: 'c3', padreId: null, clave: 'tours', nombre: 'Tours', hijas: [] },
];

describe('roles', () => {
  it('normaliza y compara', () => {
    expect(normalizarRol('ROLE_ADMIN')).toBe('admin');
    expect(tieneAlgunRol(['ADMIN'], ['admin', 'editor'])).toBe(true);
    expect(tieneAlgunRol(['usuario'], ['admin'])).toBe(false);
    expect(tieneAlgunRol(null, ['admin'])).toBe(false);
    expect(rolPrincipal(['ventas', 'editor'])).toBe('editor');
    expect(rolPrincipal(['usuario'])).toBeNull();
  });
});

describe('cola', () => {
  it('espera y urgencia', () => {
    expect(esperaTexto(0)).toBe('Menos de 1 h');
    expect(esperaTexto(9)).toBe('9 h');
    expect(esperaTexto(55)).toBe('2 d 7 h');
    expect(esperaTexto(144)).toBe('6 d');
    expect(urgenciaInfo('urgente').texto).toBe('Urgente');
    expect(urgenciaInfo('lo-que-sea').texto).toBe('Normal');
  });
  it('resultado del historial', () => {
    expect(resultadoInfo('aprobado').clase).toBe('ok');
    expect(resultadoInfo('rechazada').clase).toBe('mal');
  });
  it('categorías', () => {
    expect(nombreCategoria(arbol, 'hotel')).toBe('Hotel');
    expect(nombreCategoria(arbol, 'vida_nocturna')).toBe('Vida nocturna');
    expect(categoriasPlanas(arbol).map((c) => c.etiqueta)).toEqual(['Dónde dormir › Hotel', 'Tours']);
  });
});

describe('cambios propuestos', () => {
  it('texto simple, categoría y objetos', () => {
    const f = filasDeCambios(
      {
        nombre_comercial: { antes: 'Hotel Casa Azul', despues: 'Hotel Casa Azul Boutique' },
        categoria_id: { antes: 'c2', despues: 'c3' },
        'traduccion.es': { antes: { descripcionCorta: 'Hotel céntrico.' }, despues: { descripcionCorta: 'Hotel boutique.', descripcion: null } },
        sucursal_principal_ubicacion: { antes: { latitud: 17.06, longitud: -96.72 }, despues: { latitud: 17.07, longitud: -96.73 } },
      },
      arbol,
    );
    expect(f.map((x) => x.etiqueta)).toEqual(['Nombre comercial', 'Categoría', 'Textos (español)', 'Ubicación en el mapa']);
    expect(f[0].despues[0].texto).toBe('Hotel Casa Azul Boutique');
    expect(f[1].antes[0].texto).toBe('Hotel');
    expect(f[1].despues[0].texto).toBe('Tours');
    expect(f[2].despues).toEqual([{ nombre: 'Descripción corta', texto: 'Hotel boutique.' }]);
    expect(f[3].despues.map((l) => l.nombre)).toEqual(['Latitud', 'Longitud']);
    expect(f.every((x) => !x.incompleto)).toBe(true);
  });
  it('marca el incompleto y tolera null', () => {
    expect(filasDeCambios(null)).toEqual([]);
    const f = filasDeCambios({ nombre_comercial: { antes: 'A' } });
    expect(f[0].incompleto).toBe(true);
    expect(f[0].despues[0].texto).toBe('—');
  });
});

describe('motivo y promociones', () => {
  it('límites', () => {
    expect(errorDeMotivo('', MOTIVO_FICHA)).toBeTruthy();
    expect(errorDeMotivo('corto', MOTIVO_FICHA)).toContain('al menos 10');
    expect(errorDeMotivo('Este motivo sí alcanza.', MOTIVO_FICHA)).toBeNull();
    expect(errorDeMotivo('x'.repeat(301), MOTIVO_PROMOCION)).toContain('300');
    expect(errorDeMotivo('Ok', MOTIVO_PROMOCION)).toBeNull();
  });
  it('valor de promoción', () => {
    expect(valorPromo({ tipo: 'descuento_pct', valor: 15 })).toBe('15 %');
    expect(valorPromo({ tipo: 'descuento_monto', valor: 500 })).toBe('$500');
    expect(valorPromo({ tipo: 'dos_por_uno', valor: null })).toBe('2×1');
  });
  it('destino seguro', () => {
    expect(destinoSeguro('/cola')).toBe('/cola');
    expect(destinoSeguro('//malo.com')).toBeNull();
    expect(destinoSeguro('https://x.com')).toBeNull();
  });
});
