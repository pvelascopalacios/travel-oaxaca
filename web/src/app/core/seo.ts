import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { IDIOMAS, SITE_URL } from './config';
import { I18n } from './i18n';

/** Título, descripción, enlace canónico y versiones por idioma de cada página. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly titulo = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly sitio = inject(SITE_URL);
  private readonly i18n = inject(I18n);

  /** `ruta` va sin idioma ni diagonal inicial: '' para el inicio, 'dormir', 'negocio/hotel-x'. */
  pagina(titulo: string, descripcion: string, ruta = '', opciones: { noIndexar?: boolean; imagen?: string | null; idiomas?: readonly string[] | null; tipo?: string } = {}): void {
    const completo = titulo.includes('Travel Oaxaca') ? titulo : `${titulo} · Travel Oaxaca`;
    this.titulo.setTitle(completo);
    this.doc.documentElement.lang = this.i18n.lang();
    const lang = this.i18n.lang();
    const url = this.url(lang, ruta);
    const props: Record<string, string> = {
      'name:description': descripcion,
      'name:robots': opciones.noIndexar ? 'noindex,follow' : 'index,follow',
      'property:og:title': completo,
      'property:og:description': descripcion,
      'property:og:type': opciones.tipo ?? 'website',
      'property:og:url': url,
      'property:og:locale': lang === 'es' ? 'es_MX' : 'en_US',
      'name:twitter:card': opciones.imagen ? 'summary_large_image' : 'summary',
    };
    if (opciones.imagen) props['property:og:image'] = opciones.imagen;
    for (const [llave, contenido] of Object.entries(props)) {
      const [tipo, nombre] = [llave.slice(0, llave.indexOf(':')), llave.slice(llave.indexOf(':') + 1)];
      this.meta.updateTag({ [tipo]: nombre, content: contenido });
    }
    if (!opciones.imagen) this.meta.removeTag('property="og:image"');
    this.enlaces(lang, ruta, url, opciones.idiomas ?? null);
    // Cada página declara sus datos estructurados después; si no los declara, no queda el JSON-LD de la anterior.
    this.jsonLd(null);
  }

  private url(lang: string, ruta: string): string {
    return `${this.sitio.replace(/\/$/, '')}/${lang}${ruta ? '/' + ruta : ''}`;
  }

  private enlaces(lang: string, ruta: string, canonica: string, disponibles: readonly string[] | null): void {
    this.doc.head.querySelectorAll('link[data-seo]').forEach((n) => n.remove());
    const poner = (rel: string, href: string, hreflang?: string) => {
      const l = this.doc.createElement('link');
      l.setAttribute('rel', rel);
      l.setAttribute('href', href);
      if (hreflang) l.setAttribute('hreflang', hreflang);
      l.setAttribute('data-seo', '');
      this.doc.head.appendChild(l);
    };
    poner('canonical', canonica);
    // Solo se anuncian los idiomas que la API dice que existen para esta página.
    const idiomas = IDIOMAS.filter((i) => !disponibles?.length || disponibles.includes(i));
    const lista = idiomas.length ? idiomas : IDIOMAS;
    if (lista.length > 1) for (const i of lista) poner('alternate', this.url(i, ruta), i);
    poner('alternate', this.url(lista.includes('es') ? 'es' : lista[0], ruta), 'x-default');
    void lang;
  }

  /**
   * Datos estructurados (schema.org) tal como los arma la API. Con null se quita el bloque.
   * El `<` se escribe como \u003c para que ningún texto del negocio pueda cerrar la etiqueta script.
   */
  jsonLd(datos: Record<string, unknown> | null | undefined): void {
    this.doc.head.querySelectorAll('script[data-seo-jsonld]').forEach((n) => n.remove());
    if (!datos) return;
    const s = this.doc.createElement('script');
    s.setAttribute('type', 'application/ld+json');
    s.setAttribute('data-seo-jsonld', '');
    s.textContent = JSON.stringify(datos).replace(/</g, '\\u003c');
    this.doc.head.appendChild(s);
  }
}
