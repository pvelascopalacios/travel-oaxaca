-- =====================================================================
-- Migración 13: explorar (paso 5 de la API)
-- Función que dice si una sucursal está abierta en un momento dado, para el
-- filtro "abierto ahora" y la etiqueta de cada tarjeta. No crea tablas.
-- =====================================================================

-- Devuelve true (abierta), false (cerrada) o NULL cuando la sucursal no tiene ningún horario capturado.
-- Convención de día: 0 = domingo ... 6 = sábado (igual que EXTRACT(DOW)).
-- Una excepción de fecha manda sobre el horario semanal de ese día.
-- Un tramo con cierra <= abre pasa de medianoche y sigue abierto hasta `cierra` del día siguiente.
CREATE OR REPLACE FUNCTION sucursal_abierta(p_sucursal uuid, p_ahora timestamptz, p_zona text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local  timestamp := p_ahora AT TIME ZONE p_zona;
  v_hoy    date      := v_local::date;
  v_hora   time      := v_local::time;
  v_dow    int       := EXTRACT(DOW FROM v_local)::int;
  v_ayer   int       := (EXTRACT(DOW FROM v_local)::int + 6) % 7;
  v_abierto boolean;
  v_desborde boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM horario WHERE sucursal_id = p_sucursal)
     AND NOT EXISTS (SELECT 1 FROM horario_excepcion WHERE sucursal_id = p_sucursal) THEN
    RETURN NULL;
  END IF;

  -- Lo de hoy
  IF EXISTS (SELECT 1 FROM horario_excepcion WHERE sucursal_id = p_sucursal AND fecha = v_hoy) THEN
    SELECT EXISTS (SELECT 1 FROM horario_excepcion e
                   WHERE e.sucursal_id = p_sucursal AND e.fecha = v_hoy AND NOT e.cerrado
                     AND v_hora >= e.abre AND (e.cierra <= e.abre OR v_hora < e.cierra))
      INTO v_abierto;
  ELSE
    SELECT EXISTS (SELECT 1 FROM horario h
                   WHERE h.sucursal_id = p_sucursal AND h.dia_semana = v_dow AND NOT h.cerrado
                     AND v_hora >= h.abre AND (h.cierra <= h.abre OR v_hora < h.cierra))
      INTO v_abierto;
  END IF;

  -- Lo que viene de ayer y pasó de medianoche
  IF EXISTS (SELECT 1 FROM horario_excepcion WHERE sucursal_id = p_sucursal AND fecha = v_hoy - 1) THEN
    SELECT EXISTS (SELECT 1 FROM horario_excepcion e
                   WHERE e.sucursal_id = p_sucursal AND e.fecha = v_hoy - 1 AND NOT e.cerrado
                     AND e.cierra <= e.abre AND v_hora < e.cierra)
      INTO v_desborde;
  ELSE
    SELECT EXISTS (SELECT 1 FROM horario h
                   WHERE h.sucursal_id = p_sucursal AND h.dia_semana = v_ayer AND NOT h.cerrado
                     AND h.cierra <= h.abre AND v_hora < h.cierra)
      INTO v_desborde;
  END IF;

  RETURN v_abierto OR v_desborde;
END $$;
