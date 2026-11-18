package mx.com.traveloaxaca.inicio.servicio;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio;
import mx.com.traveloaxaca.inicio.dto.InicioDtos.*;
import mx.com.traveloaxaca.inicio.repo.InicioRepositorio;
import mx.com.traveloaxaca.inicio.repo.InicioRepositorio.BloqueFila;
import mx.com.traveloaxaca.inicio.repo.InicioRepositorio.PublicaFila;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import mx.com.traveloaxaca.negocios.servicio.Validaciones;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contenido editorial de la pantalla de inicio. Como en lugares y eventos, siempre se guarda primero como borrador y,
 * con todo el contenido ya puesto, se pasa al estado pedido: la base exige entonces el español, la foto y las reglas de cada tipo.
 */
@Service
@Transactional
public class InicioServicio {

    private static final ZoneId MEXICO = ZoneId.of("America/Mexico_City");
    private static final Set<String> TIPOS = Set.of("destacado", "pueblo", "historia", "reel");
    private static final Pattern RUTA = Pattern.compile("^/[A-Za-z0-9/_?=&.%-]*$");
    private static final Pattern FACEBOOK = Pattern.compile("^https://(((www|m)\\.)?facebook\\.com|fb\\.watch)/.*$");

    private final InicioRepositorio repo;
    private final CatalogoRepositorio catalogo;
    private final CatalogoServicio idiomas;
    private final AlmacenMedios almacen;

    public InicioServicio(InicioRepositorio repo, CatalogoRepositorio catalogo, CatalogoServicio idiomas,
                          AlmacenMedios almacen) {
        this.repo = repo;
        this.catalogo = catalogo;
        this.idiomas = idiomas;
        this.almacen = almacen;
    }

    // ---------------- web pública ----------------

    @Transactional(readOnly = true)
    public InicioPublicoDto inicio(String destino, String idiomaPedido) {
        String d = destino == null || destino.isBlank() ? ExplorarServicio.DESTINO_BASE : destino.trim();
        String idioma = idiomas.idioma(idiomaPedido);
        Map<String, List<BloquePublicoDto>> porTipo = new LinkedHashMap<>();
        TIPOS.forEach(t -> porTipo.put(t, new ArrayList<>()));
        for (PublicaFila f : repo.publicas(d, idioma, LocalDate.now(MEXICO))) {
            porTipo.get(f.tipo()).add(new BloquePublicoDto(f.id(), f.etiqueta(), f.titulo(), f.texto(), f.boton(),
                    almacen.urlPublica(f.fotoClave()), f.credito(), f.ruta(), f.enlace(), f.comunidades(), f.saludo(),
                    f.saludoIdioma(), f.persona(), f.lugarTexto(), f.negocioSlug()));
        }
        return new InicioPublicoDto(porTipo.get("destacado"), porTipo.get("pueblo"), porTipo.get("historia"),
                porTipo.get("reel"));
    }

    // ---------------- panel ----------------

    @Transactional(readOnly = true)
    public Pagina<BloqueResumenDto> listar(String tipo, String estado, Integer pagina, Integer tamano) {
        int tam = tamano == null ? 20 : Math.max(1, Math.min(100, tamano));
        int pag = pagina == null ? 0 : Math.max(0, pagina);
        String t = Validaciones.limpiar(tipo);
        String e = Validaciones.limpiar(estado);
        var filas = repo.listar(t, e, tam, pag * tam).stream().map(r -> new BloqueResumenDto(r.id(), r.tipo(),
                r.orden(), r.estado(), r.titulo(), r.publicarDesde(), r.publicarHasta())).toList();
        return new Pagina<>(filas, repo.contar(t, e), pag, tam);
    }

    @Transactional(readOnly = true)
    public BloqueAdminDto ver(UUID id) {
        BloqueFila f = repo.fila(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese bloque."));
        Map<String, TextoBloqueDto> textos = new LinkedHashMap<>();
        repo.textos(id).forEach(t -> textos.put(t.idiomaCodigo(),
                new TextoBloqueDto(t.etiqueta(), t.titulo(), t.texto(), t.boton())));
        return new BloqueAdminDto(f.id(), f.tipo(), f.orden(), f.estado(), f.publicarDesde(), f.publicarHasta(),
                f.medioId(), f.fotoClave() == null ? null : almacen.urlPublica(f.fotoClave()), f.credito(), f.ruta(),
                f.enlace(), f.comunidades(), f.saludo(), f.saludoIdioma(), f.saludoVerificadoPor(), f.persona(),
                f.lugarTexto(), f.negocioId(), f.permisoConfirmado(), textos, f.actualizadoEn());
    }

    public BloqueAdminDto crear(Actor actor, BloqueEntradaDto entrada) {
        BloqueEntradaDto e = normalizar(entrada);
        validar(e);
        UUID id = UUID.randomUUID();
        UUID destino = repo.destinoPorDefecto().orElseThrow(() -> BusinessException.invalida("No hay un destino activo."));
        repo.insertar(id, destino, e.tipo());
        aplicar(actor, id, e);
        return ver(id);
    }

    public BloqueAdminDto actualizar(Actor actor, UUID id, BloqueEntradaDto entrada) {
        BloqueFila actual = repo.fila(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese bloque."));
        BloqueEntradaDto e = normalizar(entrada);
        if (!actual.tipo().equals(e.tipo())) {
            throw BusinessException.invalida("El tipo de un bloque no se puede cambiar. Crea uno nuevo.",
                    Map.of("tipo", "Es " + actual.tipo() + "."));
        }
        validar(e);
        repo.cambiarEstado(id, "borrador");
        aplicar(actor, id, e);
        return ver(id);
    }

    public void archivar(UUID id) {
        if (!repo.estaActivo(id)) {
            throw BusinessException.noEncontrado("No encontramos ese bloque.");
        }
        repo.archivar(id);
    }

    private void aplicar(Actor actor, UUID id, BloqueEntradaDto e) {
        repo.guardar(id, e);
        repo.reemplazarTextos(id, e.traducciones());
        if (e.medioId() != null) {
            repo.aprobarMedio(e.medioId(), actor.usuarioId());
        }
        repo.cambiarEstado(id, e.estado());
    }

    /** Cada tipo conserva solo sus campos; lo demás se descarta para que no queden datos sueltos. */
    private static BloqueEntradaDto normalizar(BloqueEntradaDto e) {
        String tipo = e.tipo();
        boolean destacado = "destacado".equals(tipo), pueblo = "pueblo".equals(tipo),
                historia = "historia".equals(tipo), reel = "reel".equals(tipo);
        String saludo = pueblo ? Validaciones.limpiar(e.saludo()) : null;
        Map<String, TextoBloqueDto> textos = new LinkedHashMap<>();
        e.traducciones().forEach((k, v) -> textos.put(k, new TextoBloqueDto(Validaciones.limpiar(v.etiqueta()),
                v.titulo().trim(), Validaciones.limpiar(v.texto()), Validaciones.limpiar(v.boton()))));
        return new BloqueEntradaDto(tipo, e.orden() == null ? 0 : e.orden(), e.estado(), e.publicarDesde(),
                e.publicarHasta(), e.medioId(), Validaciones.limpiar(e.credito()),
                destacado ? Validaciones.limpiar(e.ruta()) : null, reel ? Validaciones.limpiar(e.enlace()) : null,
                pueblo ? e.comunidades() : null, saludo, saludo == null ? null : Validaciones.limpiar(e.saludoIdioma()),
                saludo == null ? null : Validaciones.limpiar(e.saludoVerificadoPor()),
                historia ? Validaciones.limpiar(e.persona()) : null, historia ? Validaciones.limpiar(e.lugar()) : null,
                historia ? e.negocioId() : null, historia && e.permisoConfirmado(), textos);
    }

    private void validar(BloqueEntradaDto e) {
        if (!e.traducciones().containsKey("es")) {
            throw BusinessException.invalida("El texto en español es obligatorio.",
                    Map.of("traducciones", "Falta el texto en español (es)."));
        }
        for (String idioma : e.traducciones().keySet()) {
            if (!catalogo.idiomaExiste(idioma)) {
                throw BusinessException.invalida("El idioma \"" + idioma + "\" no existe o no está activo.",
                        Map.of("traducciones", "Idioma no válido: " + idioma));
            }
        }
        if (e.publicarDesde() != null && e.publicarHasta() != null && e.publicarHasta().isBefore(e.publicarDesde())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("publicarHasta", "Elige una fecha igual o posterior."));
        }
        if (e.ruta() != null && (!RUTA.matcher(e.ruta()).matches() || e.ruta().startsWith("//"))) {
            throw BusinessException.invalida("La ruta debe ser una página de este sitio, por ejemplo /lugar/monte-alban.",
                    Map.of("ruta", "Empieza con / y no lleva dominio."));
        }
        if (e.enlace() != null && !FACEBOOK.matcher(e.enlace()).matches()) {
            throw BusinessException.invalida("Los Reels enlazan a Facebook (https://www.facebook.com/... o https://fb.watch/...).",
                    Map.of("enlace", "Debe ser un enlace de Facebook."));
        }
        if (e.medioId() != null && !repo.medioValido(e.medioId())) {
            throw BusinessException.invalida("La foto no existe o todavía no se confirma su subida.",
                    Map.of("medioId", "Sube y confirma la foto antes de elegirla."));
        }
        if (e.negocioId() != null && !repo.negocioExiste(e.negocioId())) {
            throw BusinessException.invalida("Ese negocio no existe.", Map.of("negocioId", "Ese negocio no existe."));
        }
        if (e.saludo() != null) {
            if (e.saludoIdioma() == null || !repo.idiomaIndigena(e.saludoIdioma())) {
                throw BusinessException.invalida("El saludo debe ser en una lengua indígena del catálogo (zap, mix...).",
                        Map.of("saludoIdioma", "Elige la lengua del saludo."));
            }
            if (e.saludoVerificadoPor() == null) {
                throw BusinessException.invalida("Un saludo en lengua indígena necesita indicar quién lo verificó.",
                        Map.of("saludoVerificadoPor", "Indica quién lo verificó."));
            }
        }
        if ("publicado".equals(e.estado())) {
            exigirParaPublicar(e);
        }
    }

    private static void exigirParaPublicar(BloqueEntradaDto e) {
        Map<String, String> faltas = new LinkedHashMap<>();
        if (e.medioId() == null) {
            faltas.put("medioId", "Sin foto no se muestra: elige una.");
        }
        TextoBloqueDto es = e.traducciones().get("es");
        switch (e.tipo()) {
            case "destacado" -> {
                if (e.ruta() == null) {
                    faltas.put("ruta", "Indica a qué página lleva.");
                }
                if (es.boton() == null) {
                    faltas.put("traducciones.es.boton", "Escribe el texto del botón.");
                }
            }
            case "reel" -> {
                if (e.enlace() == null) {
                    faltas.put("enlace", "Pega el enlace del Reel en Facebook.");
                }
            }
            case "historia" -> {
                if (e.persona() == null) {
                    faltas.put("persona", "Indica quién es la persona de la historia.");
                }
                if (!e.permisoConfirmado()) {
                    faltas.put("permisoConfirmado", "Confirma que la persona dio su permiso.");
                }
            }
            default -> {
            }
        }
        if (!faltas.isEmpty()) {
            throw BusinessException.invalida("Para publicar falta completar: " + String.join(" ", faltas.values()), faltas);
        }
    }
}
