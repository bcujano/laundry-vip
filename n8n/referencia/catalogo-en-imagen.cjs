// REFERENCIA — NO SE DESPLIEGA (apagado el 2026-10-05).
// Cadena que manda una imagen a WhatsApp como FOTO nativa (adjunto en Chatwoot, no enlace):
//   ¿primer contacto? → descargar imagen → ponerle nombre/tipo → subirla multipart a Chatwoot.
// Se probó el tramo de Chatwoot (acepta el adjunto como imagen). Falta cambiar el origen: el dueño
// quiere usar SU imagen (Google Drive/Fotos), no una generada por el CRM. Para encenderla:
// copiar este módulo a n8n/generador/, poner `URL_CATALOGO` con el enlace directo a su imagen,
// requerirlo en generar.cjs y publicar por MCP. Ver docs/CONTINUIDAD.md §4 (C1).
// Catálogo en imagen en el primer contacto. El CRM la dibuja en el momento con los
// precios vigentes (GET /api/catalogo); aquí se descarga y se manda por Chatwoot como
// ADJUNTO, así llega a WhatsApp como foto nativa (no como enlace) y queda en el chat.
const crypto = require('node:crypto')
const URL_CATALOGO = 'REEMPLAZAR: enlace directo a la imagen del dueño'
const CW = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }

const nombrarImagen = `// Chatwoot y WhatsApp deciden cómo mostrarlo por el nombre y el tipo del archivo.
const it = $input.first();
it.binary.data.fileName = 'catalogo.png';
it.binary.data.mimeType = 'image/png';
return [{ json: it.json, binary: it.binary }];`

// Primer contacto = en esta conversación nadie (ni el agente ni una persona) ha
// escrito todavía al cliente. No aplica al equipo ni a un chat que se escala.
const PRIMER_CONTACTO = `={{ (() => {
  const previos = (($('Obtener Ultimos Mensajes').first().json.payload) || []).filter((m) => m.message_type === 1 && !m.private);
  let esEquipo = false;
  try { esEquipo = $('Verificar Operador').first().json.data.es_operador === true; } catch (e) {}
  return previos.length === 0 && !esEquipo && $('Extraer JSON').first().json.escalar_humano !== 'si';
})() }}`

const nodos = [
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'primer-contacto',
            leftValue: PRIMER_CONTACTO,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Primer Contacto?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [3200, 400],
    id: crypto.randomUUID(),
    notes: 'Solo la primera vez que alguien escribe: se le manda el catálogo en imagen.',
  },
  {
    parameters: {
      url: URL_CATALOGO,
      options: {
        response: { response: { responseFormat: 'file', outputPropertyName: 'data' } },
        timeout: 30000,
      },
    },
    name: 'Descargar Catalogo',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3440, 400],
    id: crypto.randomUUID(),
    onError: 'continueRegularOutput',
  },
  {
    parameters: { jsCode: nombrarImagen },
    name: 'Nombrar Catalogo',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [3680, 400],
    id: crypto.randomUUID(),
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      method: 'POST',
      url: `=${CW}/{{ $('WhatsApp Inicio').item.json._chatwoot_conversation_id }}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'attachments[]', inputDataFieldName: 'data' },
          { name: 'message_type', value: 'outgoing' },
          { name: 'private', value: 'false' },
        ],
      },
      options: { timeout: 30000 },
    },
    name: 'Enviar Catalogo',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3920, 400],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
]

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Enviar Respuesta Chatwoot': main('Primer Contacto?'),
  'Primer Contacto?': main('Descargar Catalogo'),
  'Descargar Catalogo': main('Nombrar Catalogo'),
  'Nombrar Catalogo': main('Enviar Catalogo'),
}

module.exports = { nodos, conexiones }
