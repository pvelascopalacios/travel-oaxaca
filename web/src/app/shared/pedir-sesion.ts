import { Router } from '@angular/router';
import { I18n } from '../core/i18n';

/** Lleva a «Ingresar» y, al terminar, regresa a la misma página. */
export function irAIngresar(router: Router, i18n: I18n): void {
  void router.navigate(['/', i18n.lang(), 'ingresar'], { queryParams: { volver: router.url.split('#')[0] } });
}
