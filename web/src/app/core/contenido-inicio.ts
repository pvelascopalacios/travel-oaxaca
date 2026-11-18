/**
 * Contenido editorial del inicio: lo que solo Oaxaca Explora puede contar.
 *
 * Mientras el panel de administración no tenga su apartado «Inicio», se edita aquí. Cada lista vacía oculta su sección,
 * así que el sitio funciona desde el primer día sin nada de esto. Reglas:
 *  - Las fotos van en `public/contenido/` y se escriben como '/contenido/archivo.jpg'.
 *  - Los saludos en lenguas indígenas se publican solo después de verificarse con fuentes o con hablantes.
 *  - Una tarjeta sin foto no se muestra.
 *  - Las historias de personas llevan su permiso.
 */

export interface Bilingue {
  es: string;
  en: string;
}

/** Tarjeta del Destacado. `ruta` va sin idioma: ['lugar', 'monte-alban'] o ['descubrir']. */
export interface DestacadoEditorial {
  id: string;
  etiqueta: Bilingue;
  titulo: Bilingue;
  texto: Bilingue;
  foto: string;
  credito?: string;
  boton: Bilingue;
  ruta: string[];
  queryParams?: Record<string, string>;
}

export interface PuebloEditorial {
  nombre: Bilingue;
  donde: Bilingue;
  comunidades?: number;
  /** Saludo en la lengua, ya verificado. */
  saludo?: string;
  foto: string;
}

export interface HistoriaEditorial {
  negocio: string;
  /** Slug de la ficha en la guía, si ya existe. */
  slug?: string;
  lugar: string;
  frase: Bilingue;
  foto: string;
}

export interface ReelEditorial {
  titulo: Bilingue;
  lugar: string;
  /** Enlace al Reel en Facebook. */
  url: string;
  miniatura: string;
}

export const DESTACADOS: DestacadoEditorial[] = [];
export const PUEBLOS: PuebloEditorial[] = [];
export const HISTORIAS: HistoriaEditorial[] = [];
export const REELS: ReelEditorial[] = [];

/*
Ejemplo de un destacado:
{
  id: 'chacahua',
  etiqueta: { es: 'Visto en Oaxaca Explora', en: 'Seen on Oaxaca Explora' },
  titulo: { es: 'La laguna donde nadie va', en: 'The lagoon nobody visits' },
  texto: { es: 'Laguna de Chacahua, en la Costa.', en: 'Chacahua Lagoon, on the Coast.' },
  foto: '/contenido/chacahua.jpg',
  credito: '@exploraoaxacamexico',
  boton: { es: 'Ver el lugar', en: 'See the place' },
  ruta: ['lugar', 'laguna-de-chacahua'],
},
*/
