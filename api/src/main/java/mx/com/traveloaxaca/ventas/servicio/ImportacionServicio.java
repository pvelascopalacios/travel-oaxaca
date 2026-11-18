package mx.com.traveloaxaca.ventas.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.SlugUtil;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ErrorFilaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ImportacionDto;
import mx.com.traveloaxaca.ventas.repo.ImportacionRepositorio;
import mx.com.traveloaxaca.ventas.repo.ImportacionRepositorio.Fila;
import mx.com.traveloaxaca.ventas.repo.ImportacionRepositorio.Opcion;
import mx.com.traveloaxaca.ventas.repo.ProspectoRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Carga masiva por CSV en tres pasos: subir (se valida sin guardar nada), revisar y aplicar.
 * Al aplicar se vuelve a validar contra la base de ese momento y todo se guarda en una sola transacción.
 */
@Service
public class ImportacionServicio {

    static final int MAX_FILAS = 2000;
    static final int MAX_BYTES = 2 * 1024 * 1024;
    static final int MAX_ERRORES_GUARDADOS = 500;
    static final List<String> TIPOS = List.of("prospectos", "negocios", "lugares", "eventos");
    private static final Set<String> TIPOS_LUGAR = Set.of("arqueologico", "natural", "cultural", "playa", "mercado", "templo", "otro",
            "bosque", "mirador", "cascada", "presa");

    private static final Map<String, List<String>> REQUERIDAS = Map.of(
            "prospectos", List.of("nombre_negocio"),
            "negocios", List.of("nombre", "categoria", "municipio"),
            "lugares", List.of("nombre", "tipo", "municipio"),
            "eventos", List.of("titulo", "municipio", "fecha_inicio", "fecha_fin"));

    private static final Map<String, String> EJEMPLO = Map.of(
            "prospectos", "Mezcalería Don Chucho,Mezcalería,Santiago Jamiltepec,Chucho Pérez,9515550123,chucho@ejemplo.mx,facebook,Lo recomendó un cliente",
            "negocios", "Cabañas El Mirador,Hospedaje,Santa María Huatulco,,Camino a la playa s/n,15.7694,-96.1259,+529581234567,cabanas@ejemplo.mx",
            "lugares", "Hierve el Agua,natural,San Isidro Roaguía,16.8654,-96.2763,Cascadas petrificadas en la Sierra Sur.,Petrified waterfalls in the Southern Sierra.",
            "eventos", "Guelaguetza,Oaxaca de Juárez,2027-07-19,2027-07-26,,,Fiesta de los pueblos de Oaxaca.,Oaxaca's folk dance festival.");

    private final ImportacionRepositorio repo;
    private final ProspectoRepositorio prospectos;
    private final ObjectMapper json;

    public ImportacionServicio(ImportacionRepositorio repo, ProspectoRepositorio prospectos, ObjectMapper json) {
        this.repo = repo;
        this.prospectos = prospectos;
        this.json = json;
    }

    // ---------------- permisos ----------------

    static boolean puede(Actor actor, String tipo) {
        if (actor.roles().contains("admin")) {
            return true;
        }
        return "prospectos".equals(tipo) ? actor.roles().contains("ventas") : actor.roles().contains("editor");
    }

    private static void exigir(Actor actor, String tipo) {
        if (!puede(actor, tipo)) {
            throw BusinessException.prohibido("No tienes permiso para importar " + tipo + ".");
        }
    }

    private static String tipoValido(String tipo) {
        if (tipo == null || !TIPOS.contains(tipo)) {
            throw BusinessException.invalida("El tipo de importación no es válido.",
                    Map.of("tipo", "Elige prospectos, negocios, lugares o eventos."));
        }
        return tipo;
    }

    // ---------------- plantillas y reporte de errores ----------------

    public byte[] plantillaCsv(Actor actor, String tipo) {
        exigir(actor, tipoValido(tipo));
        String orden = switch (tipo) {
            case "prospectos" -> "nombre_negocio,categoria,municipio,contacto_nombre,telefono,correo,origen,notas";
            case "negocios" -> "nombre,categoria,municipio,localidad,direccion,latitud,longitud,telefono,correo";
            case "lugares" -> "nombre,tipo,municipio,latitud,longitud,descripcion_es,descripcion_en";
            default -> "titulo,municipio,fecha_inicio,fecha_fin,latitud,longitud,descripcion_es,descripcion_en";
        };
        return conBom(orden + "\n" + EJEMPLO.get(tipo) + "\n");
    }

    @Transactional(readOnly = true)
    public byte[] erroresCsv(Actor actor, UUID id) {
        Fila f = cargar(id);
        exigir(actor, f.tipo());
        StringBuilder sb = new StringBuilder("fila,campo,valor,problema\n");
        for (ErrorFilaDto e : leerErrores(f.errores())) {
            sb.append(e.fila()).append(',').append(CsvLector.escribir(e.campo())).append(',')
                    .append(CsvLector.escribir(e.valor())).append(',').append(CsvLector.escribir(e.problema())).append('\n');
        }
        return conBom(sb.toString());
    }

    private static byte[] conBom(String texto) {
        byte[] cuerpo = texto.getBytes(StandardCharsets.UTF_8);
        byte[] r = new byte[cuerpo.length + 3];
        r[0] = (byte) 0xEF;
        r[1] = (byte) 0xBB;
        r[2] = (byte) 0xBF;
        System.arraycopy(cuerpo, 0, r, 3, cuerpo.length);
        return r;
    }

    // ---------------- consulta ----------------

    @Transactional(readOnly = true)
    public Pagina<ImportacionDto> listar(Actor actor, int pagina, int tamano) {
        List<String> tipos = TIPOS.stream().filter(t -> puede(actor, t)).toList();
        if (tipos.isEmpty()) {
            throw BusinessException.prohibido("No tienes permiso para ver importaciones.");
        }
        int t = Math.min(Math.max(tamano, 1), 100);
        int p = Math.max(pagina, 0);
        List<ImportacionDto> filas = repo.listar(tipos, t, p * t).stream().map(f -> dto(f, false)).toList();
        return new Pagina<>(filas, repo.contar(tipos), p, t);
    }

    @Transactional(readOnly = true)
    public ImportacionDto detalle(Actor actor, UUID id) {
        Fila f = cargar(id);
        exigir(actor, f.tipo());
        return dto(f, true);
    }

    // ---------------- subir y validar ----------------

    @Transactional
    public ImportacionDto subir(Actor actor, String tipo, MultipartFile archivo) {
        exigir(actor, tipoValido(tipo));
        if (archivo == null || archivo.isEmpty()) {
            throw BusinessException.invalida("Elige un archivo CSV.", Map.of("archivo", "Falta el archivo."));
        }
        if (archivo.getSize() > MAX_BYTES) {
            throw BusinessException.invalida("El archivo pesa más de 2 MB.", Map.of("archivo", "Máximo 2 MB."));
        }
        String texto;
        try {
            texto = CsvLector.decodificar(archivo.getBytes());
        } catch (IOException e) {
            throw BusinessException.invalida("No pudimos leer el archivo.", Map.of("archivo", "Sube el archivo de nuevo."));
        }
        Evaluacion ev = evaluar(tipo, texto);
        String nombre = archivo.getOriginalFilename() == null ? "archivo.csv" : archivo.getOriginalFilename();
        nombre = nombre.length() > 200 ? nombre.substring(nombre.length() - 200) : nombre;
        UUID id = repo.crear(tipo, nombre, texto, ev.total, ev.validas.size(), ev.filasConError, erroresJson(ev.errores),
                actor.usuarioId());
        return dto(repo.porId(id).orElseThrow(), true);
    }

    // ---------------- aplicar y cancelar ----------------

    @Transactional
    public ImportacionDto aplicar(Actor actor, UUID id, boolean soloCorrectas) {
        Fila f = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa importación."));
        exigir(actor, f.tipo());
        if (!"validando".equals(f.estado()) || f.contenido() == null) {
            throw BusinessException.conflicto("Esta importación ya se aplicó o se canceló.");
        }
        Evaluacion ev = evaluar(f.tipo(), f.contenido());
        if (ev.validas.isEmpty()) {
            throw BusinessException.conflicto("No hay filas correctas para aplicar. Corrige el archivo y súbelo de nuevo.");
        }
        if (ev.filasConError > 0 && !soloCorrectas) {
            throw BusinessException.conflicto("Hay " + ev.filasConError
                    + " filas con error. Corrige el archivo o confirma que quieres aplicar solo las correctas.");
        }
        for (Valida v : ev.validas) {
            guardar(actor, f.tipo(), v.datos);
        }
        repo.finalizar(id, ev.filasConError > 0 ? "con_errores" : "aplicada", ev.total, ev.validas.size(),
                ev.filasConError, erroresJson(ev.errores));
        return dto(repo.porId(id).orElseThrow(), true);
    }

    @Transactional
    public ImportacionDto cancelar(Actor actor, UUID id) {
        Fila f = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa importación."));
        exigir(actor, f.tipo());
        if (!"validando".equals(f.estado())) {
            throw BusinessException.conflicto("Esta importación ya se aplicó o se canceló.");
        }
        repo.finalizar(id, "cancelada", f.totalFilas(), f.filasOk(), f.filasError(), f.errores());
        return dto(repo.porId(id).orElseThrow(), true);
    }

    // ---------------- validación por tipo ----------------

    record Valida(int fila, Map<String, Object> datos) {
    }

    static class Evaluacion {
        int total;
        int filasConError;
        final List<Valida> validas = new ArrayList<>();
        final List<ErrorFilaDto> errores = new ArrayList<>();
    }

    /** Catálogos en memoria: texto sin acentos ni mayúsculas -> opciones que lo usan. */
    private static class Catalogo {
        final Map<String, List<Opcion>> porTexto = new HashMap<>();
        final List<Opcion> todas;

        Catalogo(List<Opcion> opciones) {
            this.todas = opciones;
            for (Opcion o : opciones) {
                agregar(o.clave(), o);
                agregar(o.nombre(), o);
            }
        }

        private void agregar(String texto, Opcion o) {
            if (texto != null && !texto.isBlank()) {
                List<Opcion> l = porTexto.computeIfAbsent(norm(texto), k -> new ArrayList<>());
                if (!l.contains(o)) {
                    l.add(o);
                }
            }
        }

        List<Opcion> buscar(String texto) {
            return porTexto.getOrDefault(norm(texto), List.of());
        }

        String parecidos(String texto) {
            String n = norm(texto);
            String ini = n.length() > 3 ? n.substring(0, 3) : n;
            Set<String> r = new TreeSet<>();
            for (Opcion o : todas) {
                if (n.length() >= 2 && (norm(o.nombre()).startsWith(ini) || norm(o.nombre()).contains(n))) {
                    r.add(o.nombre());
                }
                if (r.size() >= 3) {
                    break;
                }
            }
            return r.isEmpty() ? "" : " Opciones cercanas: " + String.join(", ", r) + ".";
        }
    }

    static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** Lee una fila: cada método devuelve el dato limpio o null, y anota el problema si lo hay. */
    private static class Celdas {
        final int numero;
        final Map<String, String> v;
        final List<ErrorFilaDto> errores;
        boolean conError;

        Celdas(int numero, Map<String, String> v, List<ErrorFilaDto> errores) {
            this.numero = numero;
            this.v = v;
            this.errores = errores;
        }

        void error(String campo, String problema) {
            conError = true;
            String valor = v.getOrDefault(campo, "");
            errores.add(new ErrorFilaDto(numero, campo, valor.length() > 80 ? valor.substring(0, 80) : valor, problema));
        }

        String crudo(String campo) {
            String s = v.get(campo);
            return s == null || s.isBlank() ? null : s.trim();
        }

        String texto(String campo, boolean requerido, int max) {
            String s = crudo(campo);
            if (s == null) {
                if (requerido) {
                    error(campo, "Este dato es obligatorio.");
                }
                return null;
            }
            if (s.length() > max) {
                error(campo, "Máximo " + max + " caracteres.");
                return null;
            }
            return s;
        }

        String telefono(String campo) {
            String s = crudo(campo);
            if (s == null) {
                return null;
            }
            String t = Contactos.telefono(s);
            if (t == null) {
                error(campo, "No es un teléfono válido. Usa el formato +529515550123.");
            }
            return t;
        }

        String correo(String campo) {
            String s = crudo(campo);
            if (s == null) {
                return null;
            }
            if (!Contactos.correoValido(s)) {
                error(campo, "Correo inválido.");
                return null;
            }
            return s;
        }

        UUID opcion(String campo, Catalogo cat, boolean requerido, String que) {
            String s = crudo(campo);
            if (s == null) {
                if (requerido) {
                    error(campo, "Este dato es obligatorio.");
                }
                return null;
            }
            List<Opcion> r = cat.buscar(s);
            if (r.isEmpty()) {
                error(campo, "No existe " + que + " con ese nombre." + cat.parecidos(s));
                return null;
            }
            if (r.size() > 1) {
                error(campo, "Hay más de " + que + " con ese nombre. Usa la clave INEGI de 5 dígitos.");
                return null;
            }
            return r.get(0).id();
        }

        Double numero(String campo, double min, double max) {
            String s = crudo(campo);
            if (s == null) {
                return null;
            }
            try {
                String limpio = s.contains(".") ? s : s.replace(',', '.');
                double d = Double.parseDouble(limpio);
                if (Double.isNaN(d) || d < min || d > max) {
                    error(campo, "Debe estar entre " + min + " y " + max + ".");
                    return null;
                }
                return d;
            } catch (NumberFormatException e) {
                error(campo, "No es un número.");
                return null;
            }
        }

        /** Latitud y longitud van juntas o no va ninguna. Regresa {lat, lng} o null. */
        Double[] coordenadas() {
            Double lat = numero("latitud", -90, 90);
            Double lng = numero("longitud", -180, 180);
            if ((crudo("latitud") == null) != (crudo("longitud") == null)) {
                error(crudo("latitud") == null ? "latitud" : "longitud", "Escribe latitud y longitud, o deja las dos vacías.");
                return null;
            }
            return lat == null || lng == null ? null : new Double[] {lat, lng};
        }

        LocalDate fecha(String campo) {
            String s = crudo(campo);
            if (s == null) {
                error(campo, "Este dato es obligatorio.");
                return null;
            }
            for (DateTimeFormatter f : FORMATOS_FECHA) {
                try {
                    return LocalDate.parse(s, f);
                } catch (DateTimeParseException e) {
                    // se prueba el siguiente formato
                }
            }
            error(campo, "Fecha no válida. Usa 2027-07-19 o 19/07/2027.");
            return null;
        }
    }

    private static final List<DateTimeFormatter> FORMATOS_FECHA = List.of(
            DateTimeFormatter.ofPattern("uuuu-M-d"), DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"));

    Evaluacion evaluar(String tipo, String texto) {
        CsvLector.Resultado csv = CsvLector.leer(texto);
        List<String> faltan = REQUERIDAS.get(tipo).stream().filter(c -> !csv.encabezados().contains(c)).toList();
        if (!faltan.isEmpty()) {
            throw BusinessException.invalida("Al archivo le faltan columnas: " + String.join(", ", faltan) + ".",
                    Map.of("archivo", "Descarga la plantilla y usa sus encabezados."));
        }
        if (csv.filas().isEmpty()) {
            throw BusinessException.invalida("El archivo no tiene filas.", Map.of("archivo", "Agrega al menos una fila."));
        }
        if (csv.filas().size() > MAX_FILAS) {
            throw BusinessException.invalida("El archivo tiene más de " + MAX_FILAS + " filas.",
                    Map.of("archivo", "Divídelo en archivos de máximo " + MAX_FILAS + " filas."));
        }
        Catalogo categorias = new Catalogo(repo.categorias());
        Catalogo municipios = new Catalogo(repo.municipios());
        Evaluacion ev = new Evaluacion();
        ev.total = csv.filas().size();
        Map<String, Integer> vistos = new HashMap<>();
        Set<Integer> conError = new LinkedHashSet<>();
        for (CsvLector.Fila fila : csv.filas()) {
            Map<String, String> v = new HashMap<>();
            for (int i = 0; i < csv.encabezados().size(); i++) {
                v.put(csv.encabezados().get(i), i < fila.celdas().size() ? fila.celdas().get(i) : "");
            }
            Celdas c = new Celdas(fila.numero(), v, ev.errores);
            Map<String, Object> d = switch (tipo) {
                case "prospectos" -> prospecto(c, categorias, municipios, vistos);
                case "negocios" -> negocio(c, categorias, municipios, vistos);
                case "lugares" -> lugar(c, municipios, vistos);
                default -> evento(c, municipios, vistos);
            };
            if (c.conError || d == null) {
                conError.add(fila.numero());
            } else {
                ev.validas.add(new Valida(fila.numero(), d));
            }
        }
        ev.filasConError = conError.size();
        return ev;
    }

    private Map<String, Object> prospecto(Celdas c, Catalogo categorias, Catalogo municipios, Map<String, Integer> vistos) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("nombre", c.texto("nombre_negocio", true, 160));
        d.put("categoriaId", c.opcion("categoria", categorias, false, "una categoría"));
        d.put("municipioId", c.opcion("municipio", municipios, false, "un municipio"));
        d.put("contacto", c.texto("contacto_nombre", false, 120));
        String telefono = c.telefono("telefono");
        String correo = c.correo("correo");
        String origen = c.crudo("origen") == null ? "otro" : norm(c.crudo("origen")).replace(' ', '_');
        if (!ProspectoServicio.ORIGENES.contains(origen)) {
            c.error("origen", "Origen no válido. Opciones: " + String.join(", ", new TreeSet<>(ProspectoServicio.ORIGENES)) + ".");
        }
        d.put("telefono", telefono);
        d.put("correo", correo);
        d.put("origen", origen);
        d.put("notas", c.texto("notas", false, 2000));
        if (!c.conError) {
            repetido(c, vistos, "tel|" + telefono, telefono, "telefono", "teléfono");
            repetido(c, vistos, "cor|" + (correo == null ? null : correo.toLowerCase(Locale.ROOT)), correo, "correo", "correo");
        }
        if (!c.conError) {
            prospectos.duplicado(telefono, correo, null).ifPresent(quien -> c.error(
                    telefono != null ? "telefono" : "correo",
                    quien + " ya usa ese teléfono o correo."));
        }
        return c.conError ? null : d;
    }

    private Map<String, Object> negocio(Celdas c, Catalogo categorias, Catalogo municipios, Map<String, Integer> vistos) {
        Map<String, Object> d = new LinkedHashMap<>();
        String nombre = c.texto("nombre", true, 160);
        UUID categoria = c.opcion("categoria", categorias, true, "una categoría");
        UUID municipio = c.opcion("municipio", municipios, true, "un municipio");
        UUID localidad = null;
        if (municipio != null && c.crudo("localidad") != null) {
            List<UUID> l = repo.localidades(municipio, c.crudo("localidad"));
            if (l.size() == 1) {
                localidad = l.get(0);
            } else {
                c.error("localidad", l.isEmpty() ? "Esa localidad no existe en el municipio." : "Hay varias localidades con ese nombre.");
            }
        }
        Double[] coords = c.coordenadas();
        d.put("nombre", nombre);
        d.put("categoriaId", categoria);
        d.put("municipioId", municipio);
        d.put("localidadId", localidad);
        d.put("direccion", c.texto("direccion", false, 200));
        d.put("lat", coords == null ? null : coords[0]);
        d.put("lng", coords == null ? null : coords[1]);
        d.put("telefono", c.telefono("telefono"));
        d.put("correo", c.correo("correo"));
        if (!c.conError) {
            repetido(c, vistos, "neg|" + norm(nombre) + "|" + municipio, nombre, "nombre", "negocio");
        }
        if (!c.conError && repo.negocioExiste(nombre, municipio)) {
            c.error("nombre", "Ya existe un negocio con ese nombre en ese municipio.");
        }
        return c.conError ? null : d;
    }

    private Map<String, Object> lugar(Celdas c, Catalogo municipios, Map<String, Integer> vistos) {
        Map<String, Object> d = new LinkedHashMap<>();
        String nombre = c.texto("nombre", true, 160);
        String tipo = c.crudo("tipo") == null ? null : norm(c.crudo("tipo"));
        if (c.crudo("tipo") == null) {
            c.error("tipo", "Este dato es obligatorio.");
        } else if (!TIPOS_LUGAR.contains(tipo)) {
            c.error("tipo", "Tipo no válido. Opciones: " + String.join(", ", new TreeSet<>(TIPOS_LUGAR)) + ".");
        }
        UUID municipio = c.opcion("municipio", municipios, true, "un municipio");
        Double[] coords = c.coordenadas();
        d.put("nombre", nombre);
        d.put("tipo", tipo);
        d.put("municipioId", municipio);
        d.put("lat", coords == null ? null : coords[0]);
        d.put("lng", coords == null ? null : coords[1]);
        d.put("es", c.texto("descripcion_es", false, 4000));
        d.put("en", c.texto("descripcion_en", false, 4000));
        if (!c.conError) {
            repetido(c, vistos, "lug|" + norm(nombre) + "|" + municipio, nombre, "nombre", "lugar");
        }
        if (!c.conError && repo.lugarExiste(nombre, municipio)) {
            c.error("nombre", "Ya existe un lugar con ese nombre en ese municipio.");
        }
        return c.conError ? null : d;
    }

    private Map<String, Object> evento(Celdas c, Catalogo municipios, Map<String, Integer> vistos) {
        Map<String, Object> d = new LinkedHashMap<>();
        String titulo = c.texto("titulo", true, 160);
        UUID municipio = c.opcion("municipio", municipios, true, "un municipio");
        LocalDate inicio = c.fecha("fecha_inicio");
        LocalDate fin = c.fecha("fecha_fin");
        if (inicio != null && fin != null && fin.isBefore(inicio)) {
            c.error("fecha_fin", "La fecha de fin no puede ser anterior al inicio.");
        }
        Double[] coords = c.coordenadas();
        d.put("nombre", titulo);
        d.put("municipioId", municipio);
        d.put("inicio", inicio);
        d.put("fin", fin);
        d.put("lat", coords == null ? null : coords[0]);
        d.put("lng", coords == null ? null : coords[1]);
        d.put("es", c.texto("descripcion_es", false, 4000));
        d.put("en", c.texto("descripcion_en", false, 4000));
        if (!c.conError) {
            repetido(c, vistos, "eve|" + norm(titulo) + "|" + municipio + "|" + inicio, titulo, "titulo", "evento");
        }
        if (!c.conError && repo.eventoExiste(titulo, municipio, inicio)) {
            c.error("titulo", "Ya existe un evento con ese título en ese municipio y fecha.");
        }
        return c.conError ? null : d;
    }

    private static void repetido(Celdas c, Map<String, Integer> vistos, String clave, String valor, String campo, String que) {
        if (valor == null) {
            return;
        }
        Integer antes = vistos.putIfAbsent(clave, c.numero);
        if (antes != null) {
            c.error(campo, "Este " + que + " ya aparece en la fila " + antes + ".");
        }
    }

    // ---------------- guardado ----------------

    private void guardar(Actor actor, String tipo, Map<String, Object> d) {
        switch (tipo) {
            case "prospectos" -> prospectos.crear((String) d.get("nombre"), (UUID) d.get("categoriaId"),
                    (UUID) d.get("municipioId"), (String) d.get("contacto"), (String) d.get("telefono"),
                    (String) d.get("correo"), (String) d.get("origen"), null, null, (String) d.get("notas"));
            case "negocios" -> guardarNegocio(actor, d);
            case "lugares" -> guardarLugar(d);
            default -> guardarEvento(d);
        }
    }

    private void guardarNegocio(Actor actor, Map<String, Object> d) {
        UUID municipio = (UUID) d.get("municipioId");
        UUID destino = prospectos.destinoDeMunicipio(municipio).orElseThrow();
        String nombre = (String) d.get("nombre");
        String base = SlugUtil.base(nombre);
        String slug = SlugUtil.libre(base, prospectos.slugsParecidos(destino, base));
        UUID id = prospectos.crearNegocio(destino, slug, nombre, (UUID) d.get("categoriaId"), actor.usuarioId(), "importada");
        prospectos.crearSucursalPrincipal(id, municipio);
        repo.completarSucursal(id, (UUID) d.get("localidadId"), (String) d.get("direccion"), (Double) d.get("lat"),
                (Double) d.get("lng"));
        if (d.get("telefono") != null) {
            prospectos.crearContacto(id, "telefono", (String) d.get("telefono"));
        }
        if (d.get("correo") != null) {
            prospectos.crearContacto(id, "correo", (String) d.get("correo"));
        }
    }

    private void guardarLugar(Map<String, Object> d) {
        UUID municipio = (UUID) d.get("municipioId");
        UUID destino = prospectos.destinoDeMunicipio(municipio).orElseThrow();
        String nombre = (String) d.get("nombre");
        String base = SlugUtil.base(nombre);
        String slug = SlugUtil.libre(base, repo.slugs("lugar", destino, base));
        UUID id = repo.crearLugar(destino, municipio, slug, (String) d.get("tipo"), (Double) d.get("lat"), (Double) d.get("lng"));
        repo.traduccionLugar(id, "es", nombre, (String) d.get("es"));
        if (d.get("en") != null) {
            repo.traduccionLugar(id, "en", nombre, (String) d.get("en"));
        }
    }

    private void guardarEvento(Map<String, Object> d) {
        UUID municipio = (UUID) d.get("municipioId");
        UUID destino = prospectos.destinoDeMunicipio(municipio).orElseThrow();
        String nombre = (String) d.get("nombre");
        String base = SlugUtil.base(nombre);
        String slug = SlugUtil.libre(base, repo.slugs("evento", destino, base));
        UUID id = repo.crearEvento(destino, municipio, slug, (LocalDate) d.get("inicio"), (LocalDate) d.get("fin"),
                (Double) d.get("lat"), (Double) d.get("lng"));
        repo.traduccionEvento(id, "es", nombre, (String) d.get("es"));
        if (d.get("en") != null) {
            repo.traduccionEvento(id, "en", nombre, (String) d.get("en"));
        }
    }

    // ---------------- apoyo ----------------

    private Fila cargar(UUID id) {
        return repo.porId(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa importación."));
    }

    private ImportacionDto dto(Fila f, boolean conErrores) {
        return new ImportacionDto(f.id(), f.tipo(), f.archivo(), f.estado(), f.totalFilas(), f.filasOk(), f.filasError(),
                f.creadoEn(), f.finalizadaEn(), conErrores ? leerErrores(f.errores()) : null);
    }

    private String erroresJson(List<ErrorFilaDto> errores) {
        try {
            return json.writeValueAsString(errores.size() > MAX_ERRORES_GUARDADOS ? errores.subList(0, MAX_ERRORES_GUARDADOS) : errores);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private List<ErrorFilaDto> leerErrores(String texto) {
        try {
            return texto == null ? List.of() : json.readValue(texto, new TypeReference<List<ErrorFilaDto>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
