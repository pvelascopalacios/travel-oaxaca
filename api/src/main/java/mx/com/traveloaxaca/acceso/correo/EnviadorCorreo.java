package mx.com.traveloaxaca.acceso.correo;

/** Salida de correos. Hay dos implementaciones: consola (desarrollo) y SMTP (producción). */
public interface EnviadorCorreo {

    void enviar(String para, String asunto, String cuerpo);
}
