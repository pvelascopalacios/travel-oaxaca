package mx.com.traveloaxaca.explorar.servicio;

/** Geohash estándar. Con 5 caracteres la celda mide unos 5 km: sirve para saber la zona, no el lugar exacto. */
public final class Geohash {

    private static final char[] BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz".toCharArray();

    private Geohash() {
    }

    public static String codificar(double lat, double lng, int largo) {
        double latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
        StringBuilder sb = new StringBuilder();
        boolean par = true;
        int bit = 0, ch = 0;
        while (sb.length() < largo) {
            if (par) {
                double m = (lngMin + lngMax) / 2;
                if (lng >= m) {
                    ch = (ch << 1) | 1;
                    lngMin = m;
                } else {
                    ch <<= 1;
                    lngMax = m;
                }
            } else {
                double m = (latMin + latMax) / 2;
                if (lat >= m) {
                    ch = (ch << 1) | 1;
                    latMin = m;
                } else {
                    ch <<= 1;
                    latMax = m;
                }
            }
            par = !par;
            if (++bit == 5) {
                sb.append(BASE32[ch]);
                bit = 0;
                ch = 0;
            }
        }
        return sb.toString();
    }
}
