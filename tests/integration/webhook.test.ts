import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig, parametrosVentana } from '@/server/configuracion/repo'
import { ultimaHoraDelDia } from '@/server/scheduling/ventana'
import { corrida } from '../util/corrida.ts'

const SECRETO = process.env.N8N_WEBHOOK_SECRET as string
const CORRIDA = corrida()
const TELEFONO = `+5939${CORRIDA}22`

type Sobre = { ok: boolean; data?: unknown; error?: { code: string; message: string } }

async function llamar(
  cuerpo: unknown,
  secreto: string | null = SECRETO,
): Promise<{ estado: number; sobre: Sobre }> {
  const cabeceras = new Headers({ 'content-type': 'application/json' })
  if (secreto !== null) cabeceras.set('x-webhook-secret', secreto)

  const peticion = new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(cuerpo),
  })

  const respuesta = await POST(peticion)
  return { estado: respuesta.status, sobre: (await respuesta.json()) as Sobre }
}

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('clientes').delete().eq('telefono', TELEFONO)
  await cliente.from('conversaciones').delete().eq('telefono', TELEFONO)
  await cliente.from('eventos_procesados').delete().like('dedupe_key', `prueba-${CORRIDA}%`)
})

describe('autenticación del webhook', () => {
  it('sin cabecera responde 401', async () => {
    const { estado, sobre } = await llamar({ accion: 'calcular_vehiculo' }, null)
    expect(estado).toBe(401)
    expect(sobre.ok).toBe(false)
    expect(sobre.error?.code).toBe('NO_AUTORIZADO')
  })

  it('con secreto incorrecto responde 401', async () => {
    const { estado } = await llamar({ accion: 'calcular_vehiculo' }, 'secreto-equivocado')
    expect(estado).toBe(401)
  })

  it('con un secreto de la misma longitud pero distinto, también 401', async () => {
    const casiIgual = `${SECRETO.slice(0, -1)}${SECRETO.endsWith('a') ? 'b' : 'a'}`
    const { estado } = await llamar({ accion: 'calcular_vehiculo' }, casiIgual)
    expect(estado).toBe(401)
  })

  it('un 401 NO ejecuta la acción', async () => {
    const clave = `prueba-${CORRIDA}-sin-permiso`

    await llamar(
      { accion: 'registrar_evento_entrante', parametros: { dedupe_key: clave, tipo: 'mensaje' } },
      'secreto-equivocado',
    )

    // Si se hubiera ejecutado, la fila existiría.
    const { data } = await supabaseAdmin()
      .from('eventos_procesados')
      .select('id')
      .eq('dedupe_key', clave)

    expect(data).toHaveLength(0)
  })
})

describe('sobre de respuesta', () => {
  it('una acción desconocida se rechaza', async () => {
    const { estado, sobre } = await llamar({ accion: 'hacer_magia' })
    expect(estado).toBe(400)
    expect(sobre.error?.code).toBe('ACCION_DESCONOCIDA')
  })

  it('un cuerpo que no es JSON se rechaza sin romperse', async () => {
    const peticion = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': SECRETO },
      body: 'esto no es json',
    })
    const respuesta = await POST(peticion)
    expect(respuesta.status).toBe(400)
  })

  it('unos parámetros inválidos nombran el campo', async () => {
    const { estado, sobre } = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: '0963987124' },
    })
    expect(estado).toBe(400)
    expect(sobre.error?.code).toBe('PARAMETROS_INVALIDOS')
    expect(sobre.error?.message).toContain('telefono')
  })
})

describe('cotizar_prendas por el webhook', () => {
  it('devuelve el estimado con el sobre correcto', async () => {
    const { estado, sobre } = await llamar({
      accion: 'cotizar_prendas',
      parametros: { items: [{ descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' }] },
    })

    expect(estado).toBe(200)
    expect(sobre.ok).toBe(true)

    const data = sobre.data as { resumen: { estado: string; subtotal: number } }
    expect(data.resumen.subtotal).toBe(6.75)
    expect(data.resumen.estado).toBe('estimado_pendiente_verificacion')
  })

  it('una lista vacía devuelve 400 ITEMS_VACIOS', async () => {
    const { estado, sobre } = await llamar({
      accion: 'cotizar_prendas',
      parametros: { items: [] },
    })
    expect(estado).toBe(400)
    expect(sobre.error?.code).toBe('ITEMS_VACIOS')
  })

  it('una cantidad cero devuelve 400 CANTIDAD_INVALIDA', async () => {
    const { estado, sobre } = await llamar({
      accion: 'cotizar_prendas',
      parametros: { items: [{ descripcion: 'chal', cantidad: 0 }] },
    })
    expect(estado).toBe(400)
    expect(sobre.error?.code).toBe('CANTIDAD_INVALIDA')
  })
})

describe('acciones de logística', () => {
  it('calcular_vehiculo: 1 funda moto, 3 fundas auto', async () => {
    const moto = await llamar({ accion: 'calcular_vehiculo', parametros: { numero_fundas: 1 } })
    expect((moto.sobre.data as { vehiculo: string }).vehiculo).toBe('moto')

    const auto = await llamar({ accion: 'calcular_vehiculo', parametros: { numero_fundas: 3 } })
    expect((auto.sobre.data as { vehiculo: string }).vehiculo).toBe('auto')
  })

  it('obtener_proxima_ventana siempre devuelve una ventana futura', async () => {
    const { estado, sobre } = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })
    expect(estado).toBe(200)

    const data = sobre.data as {
      inicio: string
      ultima_hora_del_dia: string
      tarifa_combo: number
      hora_apertura: string
    }
    expect(new Date(data.inicio).getTime()).toBeGreaterThan(Date.now())
    // Sale de Configuración, que el dueño edita: se compara contra la base, no contra un fijo.
    expect(data.ultima_hora_del_dia).toBe(ultimaHoraDelDia(await parametrosVentana()))
    expect(data.tarifa_combo).toBe(Number((await obtenerConfig()).tarifa_combo))
    expect(data.hora_apertura).toMatch(/^\d{2}:\d{2}$/)
  })

  it('un domingo de madrugada ofrece el lunes, nunca rechaza', async () => {
    const { sobre } = await llamar({
      accion: 'obtener_proxima_ventana',
      parametros: { desde: '2026-09-20T07:00:00.000Z' },
    })
    const data = sobre.data as { inicio: string; es_hoy: boolean }
    expect(data.es_hoy).toBe(false)
    expect(data.inicio).toContain('2026-09-21')
  })
})

describe('cliente y memoria', () => {
  it('find_or_create_client crea y luego encuentra el mismo', async () => {
    const primera = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono: TELEFONO, nombre_negocio: `Clínica ${CORRIDA}` },
    })
    const creado = primera.sobre.data as { creado: boolean; debe_enviar_aviso_privacidad: boolean }
    expect(creado.creado).toBe(true)
    expect(creado.debe_enviar_aviso_privacidad).toBe(true)

    const segunda = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono: TELEFONO },
    })
    expect((segunda.sobre.data as { creado: boolean }).creado).toBe(false)
  })

  it('find_or_create_client rellena huecos sin pisar lo que ya hay', async () => {
    const { sobre } = await llamar({
      accion: 'find_or_create_client',
      parametros: {
        telefono: TELEFONO,
        nombre_contacto: 'Ana Pérez',
        nombre_negocio: 'Otro nombre',
        tipo_negocio: 'hotel',
      },
    })
    const cliente = (sobre.data as { cliente: Record<string, string> }).cliente
    expect(cliente.nombre_contacto).toBe('Ana Pérez')
    expect(cliente.nombre_negocio).toBe(`Clínica ${CORRIDA}`)
    expect(cliente.tipo_negocio).toBe('hotel')

    const otra = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono: TELEFONO, nombre_contacto: 'Otra persona', tipo_negocio: 'clinica' },
    })
    const igual = (otra.sobre.data as { cliente: Record<string, string> }).cliente
    expect(igual.nombre_contacto).toBe('Ana Pérez')
    expect(igual.tipo_negocio).toBe('hotel')
  })

  it('la memoria de conversación se acumula entre llamadas', async () => {
    await llamar({
      accion: 'sincronizar_memoria_conversacion',
      parametros: { telefono: TELEFONO, contexto: { paso: 'cotizando' } },
    })

    const { sobre } = await llamar({
      accion: 'sincronizar_memoria_conversacion',
      parametros: { telefono: TELEFONO, contexto: { fundas: 2 } },
    })

    const data = sobre.data as { contexto: Record<string, unknown> }
    expect(data.contexto).toEqual({ paso: 'cotizando', fundas: 2 })
  })

  it('registrar_evento_entrante reconoce el mensaje repetido', async () => {
    const clave = `prueba-${CORRIDA}-dedupe`

    const primera = await llamar({
      accion: 'registrar_evento_entrante',
      parametros: { dedupe_key: clave, tipo: 'message_created' },
    })
    expect((primera.sobre.data as { ya_procesado: boolean }).ya_procesado).toBe(false)

    const segunda = await llamar({
      accion: 'registrar_evento_entrante',
      parametros: { dedupe_key: clave, tipo: 'message_created' },
    })
    expect((segunda.sobre.data as { ya_procesado: boolean }).ya_procesado).toBe(true)
  })

  it('verificar_whitelist_operador distingue operador de cliente', async () => {
    const operador = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: '+593963987124' },
    })
    expect((operador.sobre.data as { es_operador: boolean }).es_operador).toBe(true)

    const cliente = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: TELEFONO },
    })
    expect((cliente.sobre.data as { es_operador: boolean }).es_operador).toBe(false)
  })
})
