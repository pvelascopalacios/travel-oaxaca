package mx.com.traveloaxaca.negocios.repo;

import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;

/** Arma el punto geográfico (longitud, latitud) sin pasar nulos a funciones de PostGIS. */
final class SqlGeo {

    private SqlGeo() {
    }

    static String punto(Double lat, Double lng) {
        return (lat == null || lng == null)
                ? "CAST(NULL AS geography)"
                : "CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)";
    }

    static StatementSpec conPunto(StatementSpec q, Double lat, Double lng) {
        return (lat == null || lng == null) ? q : q.param("lng", lng).param("lat", lat);
    }
}
