import { RenderMode, ServerRoute } from '@angular/ssr';

/** Todo se pinta en el servidor en cada visita: el contenido cambia con la API y debe ser indexable. */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }];
