package mx.com.traveloaxaca.comunidad.servicio;

/** Nombre público de quien opina: nombre de pila y la inicial del apellido ("Mariana L."). */
public final class Nombres {

    private Nombres() {
    }

    public static String corto(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return "Viajero";
        }
        String[] partes = nombre.trim().split("\\s+");
        if (partes.length == 1) {
            return partes[0];
        }
        return partes[0] + " " + Character.toUpperCase(partes[1].charAt(0)) + ".";
    }
}
