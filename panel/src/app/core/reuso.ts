import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Cuando cambia un parámetro de la ruta (por ejemplo /lugares/nuevo → /lugares/<id> al crear),
 * se crea de nuevo la página para que cargue sus datos y muestre su aviso.
 * Los cambios de query params (filtros, páginas) siguen reutilizando la página.
 */
export class ReusoPorParametros extends BaseRouteReuseStrategy {
  override shouldReuseRoute(futura: ActivatedRouteSnapshot, actual: ActivatedRouteSnapshot): boolean {
    return super.shouldReuseRoute(futura, actual) && JSON.stringify(futura.params) === JSON.stringify(actual.params);
  }
}
