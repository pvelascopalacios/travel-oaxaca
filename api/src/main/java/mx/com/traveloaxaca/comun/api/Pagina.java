package mx.com.traveloaxaca.comun.api;

import java.util.List;

/** Resultado paginado: la página pedida (desde 0), su tamaño y el total de registros. */
public record Pagina<T>(List<T> elementos, long total, int pagina, int tamano) {
}
