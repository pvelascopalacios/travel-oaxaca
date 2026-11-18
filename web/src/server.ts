import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Servidor de apoyo para pruebas locales: con PROXY_API=true reenvía /api a la API (API_URL), así la web
 * y la API comparten dominio como en producción. En producción esto lo hace el proxy inverso (Nginx, Caddy).
 */
if (process.env['PROXY_API'] === 'true') {
  const destino = new URL(process.env['API_URL'] ?? 'http://127.0.0.1:8081/api/v1').origin;
  app.use('/api', async (req, res) => {
    try {
      const partes: Buffer[] = [];
      if (req.method !== 'GET' && req.method !== 'HEAD') for await (const parte of req) partes.push(parte as Buffer);
      const r = await fetch(destino + req.originalUrl, {
        method: req.method,
        headers: {
          accept: 'application/json',
          'accept-language': req.headers['accept-language'] ?? 'es',
          ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
          ...(req.headers['authorization'] ? { authorization: req.headers['authorization'] } : {}),
        },
        body: partes.length ? Buffer.concat(partes) : undefined,
      });
      res.status(r.status).type(r.headers.get('content-type') ?? 'application/json').send(await r.text());
    } catch {
      res.status(502).json({ ok: false, mensajes: ['La API no responde.'] });
    }
  });
}


const API_URL = (process.env['API_URL'] ?? 'http://127.0.0.1:8081/api/v1').replace(/\/$/, '');
const SITE_URL = (process.env['SITE_URL'] ?? 'http://localhost:4000').replace(/\/$/, '');
const IDIOMAS = ['es', 'en'];

/** Páginas fijas que van al mapa del sitio. */
const PAGINAS_FIJAS = ['', 'descubrir', 'dormir', 'comer-y-beber', 'artesanias', 'eventos', 'lugares', 'rutas'];

const escapar = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface ItemMapa {
  slug: string;
  actualizadoEn: string | null;
  idiomas: string[] | null;
}

async function pedirApi<T>(ruta: string): Promise<T | null> {
  try {
    const r = await fetch(API_URL + ruta, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const cuerpo = (await r.json()) as { datos?: T };
    return cuerpo.datos ?? null;
  } catch {
    return null;
  }
}

/** Una entrada por idioma disponible, cada una con las alternativas (hreflang) hacia las demás. */
function entradas(ruta: string, lastmod: string | null, idiomas: string[] | null): string {
  const lista = IDIOMAS.filter((i) => !idiomas?.length || idiomas.includes(i));
  const url = (i: string) => `${SITE_URL}/${i}${ruta ? '/' + ruta : ''}`;
  const alternas =
    lista.length > 1
      ? lista.map((i) => `<xhtml:link rel="alternate" hreflang="${i}" href="${escapar(url(i))}"/>`).join('') +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${escapar(url(lista.includes('es') ? 'es' : lista[0]))}"/>`
      : '';
  return lista
    .map((i) => `<url><loc>${escapar(url(i))}</loc>${lastmod ? `<lastmod>${escapar(lastmod)}</lastmod>` : ''}${alternas}</url>`)
    .join('');
}

let mapaCache: { hasta: number; xml: string } | null = null;

async function construirMapa(): Promise<string> {
  const [sitemap, regiones] = await Promise.all([
    pedirApi<{ negocios: ItemMapa[]; lugares: ItemMapa[]; rutas: ItemMapa[]; eventos: ItemMapa[] }>('/publico/sitemap'),
    pedirApi<{ slug: string; totalNegocios: number; totalLugares: number; totalEventos: number }[]>('/publico/regiones/conteos'),
  ]);
  const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  const partes: string[] = PAGINAS_FIJAS.map((p) => entradas(p, null, null));
  for (const r of regiones ?? []) if (r.totalNegocios + r.totalLugares + r.totalEventos > 0) partes.push(entradas('region/' + r.slug, null, null));
  const tipos: [keyof NonNullable<typeof sitemap>, string][] = [['negocios', 'negocio'], ['lugares', 'lugar'], ['eventos', 'evento'], ['rutas', 'ruta']];
  for (const [clave, prefijo] of tipos) {
    for (const it of sitemap?.[clave] ?? []) partes.push(entradas(`${prefijo}/${encodeURIComponent(it.slug)}`, dia(it.actualizadoEn), it.idiomas));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${partes.join('')}</urlset>\n`;
}

app.get('/sitemap.xml', async (_req, res) => {
  if (!mapaCache || mapaCache.hasta < Date.now()) {
    const xml = await construirMapa();
    // Si la API no respondió el mapa queda solo con las páginas fijas; se reintenta pronto en lugar de guardarlo una hora.
    mapaCache = { xml, hasta: Date.now() + (xml.includes('/negocio/') || xml.includes('/lugar/') ? 3600_000 : 60_000) };
  }
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(mapaCache.xml);
});

app.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=3600')
    .send(
      ['User-agent: *', 'Allow: /', 'Disallow: /r/', 'Disallow: /api/', 'Disallow: /es/buscar', 'Disallow: /en/buscar', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n'),
    );
});

/**
 * Enlaces de afiliado: /r/CODIGO cuenta el clic en la API y redirige al sitio del socio.
 * Pausado o inexistente: 404 con la página de la web. Nunca se indexa.
 */
app.get('/r/:codigo', async (req, res, next) => {
  const codigo = req.params['codigo'] ?? '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(codigo)) return next();
  const q = new URLSearchParams();
  for (const k of ['o', 'd']) {
    const v = req.query[k];
    if (typeof v === 'string' && v.length <= 80) q.set(k, v);
  }
  res.set('X-Robots-Tag', 'noindex, nofollow').set('Cache-Control', 'no-store');
  try {
    const r = await fetch(`${API_URL}/publico/r/${encodeURIComponent(codigo)}${q.size ? '?' + q : ''}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    const destino = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && destino && /^https?:\/\//i.test(destino)) return res.redirect(302, destino);
    if (r.status === 404 || r.status === 410) return next();
    return res.status(502).type('text/plain').send('No se pudo abrir el enlace. Intenta de nuevo.');
  } catch {
    return res.status(502).type('text/plain').send('No se pudo abrir el enlace. Intenta de nuevo.');
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
