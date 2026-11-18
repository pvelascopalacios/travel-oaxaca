/** Ayudas visuales del panel (iniciales, colores, saludo, búsqueda del menú). Sin dependencias: se prueban solas. */

export interface ColorGrupo {
  fondo: string;
  tinta: string;
}

/** Un color por área, el mismo en el menú, en «Hoy» y en los avatares. */
export const COLORES_GRUPO: Record<string, ColorGrupo> = {
  revision: { fondo: '#fbe6ee', tinta: '#a5174f' },
  comunidad: { fondo: '#d9eef0', tinta: '#17707b' },
  ventas: { fondo: '#fdefcf', tinta: '#a86500' },
  negocios: { fondo: '#e2efd9', tinta: '#41692f' },
  contenido: { fondo: '#f6e3da', tinta: '#b4492a' },
  resultados: { fondo: '#e6e0f3', tinta: '#5b3a96' },
  admin: { fondo: '#e3e6ea', tinta: '#3b4350' },
};

const CLAVES_AVATAR = ['revision', 'comunidad', 'ventas', 'negocios', 'contenido', 'resultados'];

/** «Casa Jacaranda» → «CJ»; una sola palabra → sus dos primeras letras; vacío → «?». */
export function iniciales(texto: string | null | undefined): string {
  const palabras = (texto ?? '').trim().split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  if (palabras.length === 0) return '?';
  const letra = (p: string) => (p.match(/[\p{L}\p{N}]/u)?.[0] ?? '').toUpperCase();
  if (palabras.length === 1) return (palabras[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?').toUpperCase();
  return letra(palabras[0]) + letra(palabras[1]);
}

/** El mismo texto siempre da el mismo color, para que un negocio no cambie de avatar entre visitas. */
export function colorAvatar(texto: string | null | undefined): ColorGrupo {
  let h = 0;
  for (const c of texto ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_GRUPO[CLAVES_AVATAR[h % CLAVES_AVATAR.length]];
}

export function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Barra de la ficha: verde desde 80, ocre desde 50, grana debajo. */
export function puntajeColor(p: number): string {
  return p >= 80 ? 'var(--sierra)' : p >= 50 ? 'var(--ocre)' : 'var(--grana)';
}

export const aPorcentaje = (p: number): number => Math.max(0, Math.min(100, Math.round(Number(p) || 0)));

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface Comando {
  texto: string;
  grupo: string;
  ruta: string;
}

/** Filtra por todas las palabras escritas, sin importar acentos ni mayúsculas, en el nombre o en el área. */
export function filtrarComandos<T extends Comando>(lista: T[], consulta: string): T[] {
  const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return lista;
  return lista.filter((c) => {
    const pajar = sinAcentos(`${c.texto} ${c.grupo}`);
    return palabras.every((p) => pajar.includes(p));
  });
}

/** Mueve la fila elegida sin salirse de la lista. Con lista vacía devuelve 0. */
export function moverIndice(actual: number, delta: number, largo: number): number {
  if (largo <= 0) return 0;
  return Math.max(0, Math.min(largo - 1, actual + delta));
}

export interface Variacion {
  texto: string;
  tono: 'sube' | 'baja' | 'igual';
}

/** «▲ 12 % vs. periodo anterior». Sin periodo anterior con datos no hay con qué comparar: devuelve null. */
export function variacionPorcentual(actual: number, previo: number | null | undefined): Variacion | null {
  if (previo === null || previo === undefined || previo <= 0 || actual < 0) return null;
  const p = Math.round(((actual - previo) / previo) * 100);
  if (p === 0) return { texto: '＝ igual que el periodo anterior', tono: 'igual' };
  return { texto: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)} % vs. periodo anterior`, tono: p > 0 ? 'sube' : 'baja' };
}

/** Diferencia de dos tasas (fracciones, 0.074 = 7.4 %) en puntos porcentuales. */
export function variacionPuntos(actual: number | null | undefined, previo: number | null | undefined): Variacion | null {
  if (actual === null || actual === undefined || previo === null || previo === undefined) return null;
  const d = Math.round((actual - previo) * 1000) / 10;
  if (d === 0) return { texto: '＝ igual que el periodo anterior', tono: 'igual' };
  return { texto: `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('es-MX')} puntos`, tono: d > 0 ? 'sube' : 'baja' };
}

/**
 * Teléfono en formato internacional solo con dígitos, para México: 10 dígitos → 52 + número;
 * 12 dígitos que empiezan con 52, o 13 con 521, se aceptan. Cualquier otra cosa → null (no se ofrece el botón).
 */
export function telefonoInternacional(tel: string | null | undefined): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 10) return '52' + d;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return '52' + d.slice(3);
  return null;
}

export function enlaceLlamar(tel: string | null | undefined): string | null {
  const n = telefonoInternacional(tel);
  return n ? `tel:+${n}` : null;
}

export function enlaceWhatsapp(tel: string | null | undefined): string | null {
  const n = telefonoInternacional(tel);
  return n ? `https://wa.me/${n}` : null;
}
