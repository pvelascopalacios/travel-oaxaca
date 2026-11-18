package mx.com.traveloaxaca.acceso.correo;

import mx.com.traveloaxaca.acceso.PropiedadesApp;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Modo producción: envía por SMTP con la configuración spring.mail.* (variables SPRING_MAIL_*). */
@Component
@ConditionalOnProperty(name = "app.correo.modo", havingValue = "smtp")
public class CorreoSmtp implements EnviadorCorreo {

    private final ObjectProvider<JavaMailSender> remitente;
    private final PropiedadesApp props;

    public CorreoSmtp(ObjectProvider<JavaMailSender> remitente, PropiedadesApp props) {
        this.remitente = remitente;
        this.props = props;
    }

    @Override
    public void enviar(String para, String asunto, String cuerpo) {
        JavaMailSender sender = remitente.getIfAvailable();
        if (sender == null) {
            throw new IllegalStateException("Falta configurar SPRING_MAIL_HOST para enviar correos por SMTP.");
        }
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(props.correo().remitente());
        m.setTo(para);
        m.setSubject(asunto);
        m.setText(cuerpo);
        sender.send(m);
    }
}
