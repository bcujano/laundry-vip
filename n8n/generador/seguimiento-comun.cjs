// Piezas compartidas por los módulos del seguimiento (conexión al CRM, a Chatwoot y a OpenAI).
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CW = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }
const CRED_OPENAI = { openAiApi: { id: 'GvNmUCZRx5ZvZerQ', name: 'OpenAi account' } }
const CRED_META = { httpHeaderAuth: { id: 'baJJfX3zWMindSEN', name: 'Meta WhatsApp Laundry VIP' } }
const GRAPH = 'https://graph.facebook.com/v22.0/1220603671147410/messages'

const crm = (name, cuerpo, position) => ({
  parameters: {
    method: 'POST',
    url: CRM_URL,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${cuerpo}) }}`,
    options: { timeout: 15000, response: { response: { neverError: true } } },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED_CRM,
  onError: 'continueRegularOutput',
})

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })

module.exports = {
  crypto,
  CRM_URL,
  CW,
  CRED_CRM,
  CRED_CW,
  CRED_OPENAI,
  CRED_META,
  GRAPH,
  crm,
  main,
}
