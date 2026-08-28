<?php
// ============================================================================
// PASAJE CLUB · AVISOS DEL CRM AL TELEFONO
// ----------------------------------------------------------------------------
// El CRM guarda los mensajes que llegan pero no avisa a nadie: hay que abrir
// la app para enterarse. Eso hace que una consulta pueda quedar horas sin
// respuesta.
//
// Este archivo traduce "llego un mensaje para la vendedora X" a un push. Vive
// aparte de crm_conversaciones.php a proposito: ese archivo tiene 1.200
// lineas y lo usa el panel entero, asi que cuanto menos se toque, mejor.
//
// Se usa asi, desde el CRM:
//   crmAvisar($pdo, $conversacionId, $texto);
//
// Deposita en /socios/api/
// ============================================================================

if (!function_exists('crmAvisar')) {

/**
 * Avisa a quien tiene asignada la conversacion.
 *
 * Nunca lanza: un aviso que falla no puede impedir que el mensaje del cliente
 * se guarde. Los problemas van al log.
 */
function crmAvisar(PDO $pdo, int $conversacionId, string $texto, ?string $deQuien = null): void {
    try {
        if (!function_exists('hubPush')) {
            $ruta = __DIR__ . '/hub_push.php';
            if (!is_file($ruta)) return;
            require_once $ruta;
        }
        if (!function_exists('hubPush')) return;

        $st = $pdo->prepare(
            "SELECT c.id, c.vendedor_id, c.codigo,
                    TRIM(CONCAT(COALESCE(c.cliente_nombre,''), ' ',
                                COALESCE(c.cliente_apellido,''))) AS cliente
               FROM crm_conversaciones c WHERE c.id = ?");
        $st->execute([$conversacionId]);
        $conv = $st->fetch(PDO::FETCH_ASSOC);
        if (!$conv) return;

        // Sin vendedora asignada no hay a quien avisarle. Podria avisarse a
        // todas, pero eso convierte cada consulta nueva en una notificacion
        // para diez personas.
        $vid = (int)($conv['vendedor_id'] ?? 0);
        if (!$vid) return;

        // Del id de vendedora a la ficha del hub, que es la que tiene los
        // dispositivos registrados.
        $st = $pdo->prepare("SELECT id FROM hub_personas
                              WHERE vendedor_id = ? AND estado = 'activo' LIMIT 1");
        $st->execute([$vid]);
        $personaId = (int)$st->fetchColumn();
        if (!$personaId) return;

        $cliente = trim($conv['cliente'] ?? '') ?: 'Un cliente';
        $cuerpo  = crmRecortar(trim($texto), 140);

        hubNotificar(
            $pdo,
            [$personaId],
            'crm',
            $deQuien ?: $cliente,
            $cuerpo !== '' ? $cuerpo : 'Te escribio por WhatsApp',
            '/crm/' . $conversacionId
        );
    } catch (Throwable $e) {
        error_log('[crm_avisos] ' . $e->getMessage());
    }
}


/**
 * Avisa a quien recibe una conversacion derivada.
 *
 * Es el aviso que mas importa de los dos: un mensaje nuevo se ve al abrir la
 * app, pero una conversacion que te derivaron sin avisar puede quedar dias
 * sin que sepas que existe.
 */
function crmAvisarDerivacion(PDO $pdo, int $conversacionId, int $nuevoVendedorId,
                             ?string $quienDeriva = null): void {
    try {
        if (!function_exists('hubNotificar')) {
            $ruta = __DIR__ . '/hub_push.php';
            if (!is_file($ruta)) return;
            require_once $ruta;
        }
        if (!function_exists('hubNotificar')) return;

        $st = $pdo->prepare("SELECT id FROM hub_personas
                              WHERE vendedor_id = ? AND estado = 'activo' LIMIT 1");
        $st->execute([$nuevoVendedorId]);
        $personaId = (int)$st->fetchColumn();
        if (!$personaId) return;

        $st = $pdo->prepare(
            "SELECT TRIM(CONCAT(COALESCE(cliente_nombre,''), ' ',
                                COALESCE(cliente_apellido,''))) AS cliente,
                    destino, ultimo_mensaje_preview
               FROM crm_conversaciones WHERE id = ?");
        $st->execute([$conversacionId]);
        $c = $st->fetch(PDO::FETCH_ASSOC) ?: [];

        $cliente = trim($c['cliente'] ?? '') ?: 'Un cliente';
        $detalle = trim($c['destino'] ?? '');

        hubNotificar(
            $pdo,
            [$personaId],
            'crm',
            'Te pasaron una conversacion',
            $cliente . ($detalle !== '' ? ' · ' . $detalle : '')
                     . ($quienDeriva ? ' · de ' . $quienDeriva : ''),
            '/crm/' . $conversacionId
        );
    } catch (Throwable $e) {
        error_log('[crm_avisos] derivacion: ' . $e->getMessage());
    }
}


/** Corta sin romper los acentos. mbstring no esta habilitado en el hosting. */
function crmRecortar(string $t, int $n): string {
    if (function_exists('mb_substr')) {
        return mb_strlen($t) > $n ? mb_substr($t, 0, $n) . '…' : $t;
    }
    if (strlen($t) <= $n) return $t;
    $r = substr($t, 0, $n);
    return preg_replace('/[\x80-\xBF]+$|[\xC0-\xFF]$/', '', $r) . '…';
}

}
