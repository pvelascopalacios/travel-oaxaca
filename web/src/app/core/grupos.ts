import { Clave } from './textos';

/**
 * Los cuatro grupos del menú. Cada uno junta categorías principales de negocios y tipos de lugar.
 * La ruta es la misma en español e inglés para que los enlaces se compartan sin cambiar.
 */
export interface Grupo {
  clave: 'descubrir' | 'dormir' | 'comer' | 'compras';
  ruta: string;
  titulo: Clave;
  descripcion: Clave;
  /** Claves de categorías principales de negocios que entran al grupo. */
  raices: string[];
  /** Tipos de lugar que entran al grupo. */
  tiposLugar: string[];
  incluyeEventos: boolean;
}

export const GRUPOS: Grupo[] = [
  {
    clave: 'descubrir',
    ruta: 'descubrir',
    titulo: 'grupoDescubrir',
    descripcion: 'descGrupoDescubrir',
    raices: ['tours'],
    tiposLugar: ['arqueologico', 'natural', 'cultural', 'playa', 'mercado', 'templo', 'otro'],
    incluyeEventos: true,
  },
  {
    clave: 'dormir',
    ruta: 'dormir',
    titulo: 'grupoDormir',
    descripcion: 'descGrupoDormir',
    raices: ['hospedaje'],
    tiposLugar: [],
    incluyeEventos: false,
  },
  {
    clave: 'comer',
    ruta: 'comer-y-beber',
    titulo: 'grupoComer',
    descripcion: 'descGrupoComer',
    raices: ['comida', 'vida_nocturna'],
    tiposLugar: [],
    incluyeEventos: false,
  },
  {
    clave: 'compras',
    ruta: 'artesanias',
    titulo: 'grupoCompras',
    descripcion: 'descGrupoCompras',
    raices: ['compras'],
    tiposLugar: [],
    incluyeEventos: false,
  },
];

export function grupoPorRuta(ruta: string): Grupo | undefined {
  return GRUPOS.find((g) => g.ruta === ruta);
}

/** Destinos que el buscador ofrece sin escribir nada. Si el nombre es un municipio filtra por él; si no (Hierve el Agua, Puerto Escondido), busca el texto. */
export const DESTINOS_POPULARES = [
  'Oaxaca de Juárez',
  'Puerto Escondido',
  'Hierve el Agua',
  'Mazunte',
  'Huatulco',
  'Monte Albán',
  'Huajuapan de León',
];
