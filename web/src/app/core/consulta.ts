import { Categoria } from './modelos';
import { GRUPOS, Grupo } from './grupos';

/** Texto sin acentos, en minúsculas y con espacios simples, para comparar lo que escribe el visitante. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface Consulta {
  /** Lo que busca («hoteles»). Puede quedar vacío si solo escribió un lugar. */
  que: string;
  /** El lugar que escribió después de «en» / «in», o null si no puso ninguno. */
  donde: string | null;
}

/** «hoteles en huaju» → { que: 'hoteles', donde: 'huaju' }. Parte por la primera « en » o « in » suelta. */
export function interpretar(texto: string): Consulta {
  const t = texto.trim().replace(/\s+/g, ' ');
  const m = /^(.*?)\s+(?:en|in)\s+(.+)$/i.exec(t);
  if (!m || !m[1].trim() || !m[2].trim()) return { que: t, donde: null };
  return { que: m[1].trim(), donde: m[2].trim() };
}

/** Palabra que escribe la gente → clave de categoría. Lo que no esté aquí se busca por el nombre de la categoría. */
const SINONIMOS: Record<string, string> = {
  hotel: 'hotel',
  hostal: 'hospedaje',
  hospedaje: 'hospedaje',
  alojamiento: 'hospedaje',
  dormir: 'hospedaje',
  'donde dormir': 'hospedaje',
  posada: 'posada',
  cabana: 'hospedaje',
  comer: 'comida',
  comida: 'comida',
  'donde comer': 'comida',
  restaurante: 'restaurante',
  fonda: 'fonda',
  bar: 'vida_nocturna',
  antro: 'vida_nocturna',
  mezcaleria: 'vida_nocturna',
  'vida nocturna': 'vida_nocturna',
  tour: 'tours',
  excursion: 'tours',
  paseo: 'tours',
  artesania: 'compras',
  compras: 'compras',
  tienda: 'compras',
  lodging: 'hospedaje',
  hotels: 'hotel',
  restaurant: 'restaurante',
  food: 'comida',
  shopping: 'compras',
};

function variantes(t: string): string[] {
  const n = normalizar(t);
  const v = [n];
  if (n.endsWith('es') && n.length > 4) v.push(n.slice(0, -2));
  if (n.endsWith('s') && n.length > 3) v.push(n.slice(0, -1));
  return v;
}

export interface CategoriaElegida {
  grupo: Grupo;
  /** Claves de subcategoría para el filtro «tipo»; vacío = todo el grupo. */
  tipos: string[];
  nombre: string;
}

/** Busca qué categoría quiso decir («hoteles» → Dormir, tipo hotel). Null si no la reconoce. */
export function categoriaDe(que: string, arbol: Categoria[]): CategoriaElegida | null {
  const formas = variantes(que);
  const todas: { cat: Categoria; raiz: Categoria }[] = arbol.flatMap((r) => [
    { cat: r, raiz: r },
    ...r.hijas.map((h) => ({ cat: h, raiz: r })),
  ]);
  const claveBuscada = formas.map((f) => SINONIMOS[f]).find((c) => !!c);
  const hallada =
    (claveBuscada ? todas.find((x) => x.cat.clave === claveBuscada) : undefined) ??
    todas.find((x) => variantes(x.cat.nombre).some((n) => formas.includes(n)));
  if (!hallada) return null;
  const grupo = GRUPOS.find((g) => g.raices.includes(hallada.raiz.clave));
  if (!grupo) return null;
  const esHija = hallada.cat.id !== hallada.raiz.id;
  return { grupo, tipos: esHija ? [hallada.cat.clave] : [], nombre: hallada.cat.nombre };
}

export function capitalizar(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Pone primero el municipio que se llama igual a lo escrito, luego los que empiezan igual; el resto conserva su orden. */
export function ordenarMunicipios<T extends { nombre: string }>(lista: T[], escrito: string): T[] {
  const e = normalizar(escrito);
  const rango = (m: T): number => {
    const n = normalizar(m.nombre);
    return n === e ? 0 : n.startsWith(e) ? 1 : 2;
  };
  return lista.map((m, i) => ({ m, i })).sort((a, b) => rango(a.m) - rango(b.m) || a.i - b.i).map((x) => x.m);
}
