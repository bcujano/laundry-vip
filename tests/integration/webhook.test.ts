import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig, parametrosVentana } from '@/server/configuracion/repo'
import { ultimaHoraDelDia } from '@/server/scheduling/ventana'
import { centavos, precioDe } from '../util/catalogo.ts'
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
    // El precio lo edita el dueño en el CRM: se compara contra el catálogo.
    expect(data.resumen.subtotal).toBe(centavos(3 * (await precioDe('Camiseta', 'agua'))))
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
      tarifa_recoleccion_entrega: number
      hora_apertura: string
    }
    expect(new Date(data.inicio).getTime()).toBeGreaterThan(Date.now())
    // Sale de Configuración, que el dueño edita: se compara contra la base, no contra un fijo.
    expect(data.ultima_hora_del_dia).toBe(ultimaHoraDelDia(await parametrosVentana()))
    expect(data.tarifa_recoleccion_entrega).toBe(
      Number((await obtenerConfig()).tarifa_recoleccion_entrega),
    )
    expect(data.hora_apertura).toMatch(/^\d{2}:\d{2}$/)
  })

  it('la ventana trae el lapso de entrega que el agente promete', async () => {
    const { sobre } = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })
    const data = sobre.data as { horas_entrega_min: number; horas_entrega_max: number }
    const config = await obtenerConfig()

    // El lapso también lo edita el dueño en Configuración.
    expect(data.horas_entrega_min).toBe(config.horas_entrega_min)
    expect(data.horas_entrega_max).toBe(config.horas_entrega_max)
    expect(data.horas_entrega_max).toBeGreaterThanOrEqual(data.horas_entrega_min)
  })

  it('si el cliente pide otro día, la ventana es la de ESE día', async () => {
    // El agente le dijo a un cliente «para mañana no tenemos ventana» y le
    // confirmó el pedido para hoy. La herramienta sí sabe buscar otro día.
    const { sobre } = await llamar({
      accion: 'obtener_proxima_ventana',
      parametros: { desde: '2026-10-05' },
    })
    const data = sobre.data as { inicio: string; es_hoy: boolean }

    // 2026-10-05 es lunes: la ventana cae ese mismo día, en hora de Quito.
    expect(data.inicio).toContain('2026-10-05')
    expect(data.es_hoy).toBe(false)
  })

  it('una fecha vacía o ausente sigue dando la próxima ventana', async () => {
    const vacia = await llamar({
      accion: 'obtener_proxima_ventana',
      parametros: { desde: '' },
    })
    const sinNada = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })

    expect(vacia.estado).toBe(200)
    expect((vacia.sobre.data as { inicio: string }).inicio).toBe(
      (sinNada.sobre.data as { inicio: string }).inicio,
    )
  })

  it('la ventana empieza en hora redonda, no en «13:41»', async () => {
    const { sobre } = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })
    const inicio = new Date((sobre.data as { inicio: string }).inicio)

    expect([0, 30]).toContain(inicio.getUTCMinutes())
    expect(inicio.getUTCSeconds()).toBe(0)
  })

  it('el agente sabe hasta dónde se recoge y a qué hora abre el local', async () => {
    const { sobre } = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: TELEFONO },
    })
    const negocio = (sobre.data as { negocio: { cobertura: string; horario: string } }).negocio
    const config = await obtenerConfig()

    // Nada de esto está escrito en el prompt: sale de Configuración.
    expect(negocio.cobertura).toContain(String(Number(config.radio_cobertura_km)).replace('.', ','))
    expect(negocio.horario).toContain(config.hora_apertura.slice(0, 5))
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

  it('el nombre de WhatsApp entra provisional y el nombre real lo reemplaza', async () => {
    const telefono = `+5939${CORRIDA}44`
    const nuevo = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono, nombre_whatsapp: 'Majo 💕' },
    })
    expect(
      (nuevo.sobre.data as { cliente: { nombre_contacto: string } }).cliente.nombre_contacto,
    ).toBe('Majo 💕')

    const real = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono, nombre_whatsapp: 'Majo 💕', nombre_contacto: 'María José Ortiz' },
    })
    expect(
      (real.sobre.data as { cliente: { nombre_contacto: string } }).cliente.nombre_contacto,
    ).toBe('María José Ortiz')

    // Si el cliente se corrige, el CRM se corrige con él.
    const corregido = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono, nombre_whatsapp: 'Majo 💕', nombre_contacto: 'María José Ortiz Paz' },
    })
    expect(
      (corregido.sobre.data as { cliente: { nombre_contacto: string } }).cliente.nombre_contacto,
    ).toBe('María José Ortiz Paz')

    // Pero lo que escribe el equipo en el CRM es intocable para el agente.
    await supabaseAdmin()
      .from('clientes')
      .update({ nombre_contacto: 'Nombre del CRM', nombre_contacto_origen: 'crm' })
      .eq('telefono', telefono)

    const tras = await llamar({
      accion: 'find_or_create_client',
      parametros: { telefono, nombre_whatsapp: 'Majo 💕', nombre_contacto: 'Otra persona' },
    })
    expect(
      (tras.sobre.data as { cliente: { nombre_contacto: string } }).cliente.nombre_contacto,
    ).toBe('Nombre del CRM')
    await supabaseAdmin().from('clientes').delete().eq('telefono', telefono)
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

    // El nombre sí se corrige (lo dice el cliente); el resto no se pisa.
    const otra = await llamar({
      accion: 'find_or_create_client',
      parametros: {
        telefono: TELEFONO,
        nombre_contacto: 'Ana Pérez Mora',
        tipo_negocio: 'clinica',
      },
    })
    const igual = (otra.sobre.data as { cliente: Record<string, string> }).cliente
    expect(igual.nombre_contacto).toBe('Ana Pérez Mora')
    expect(igual.nombre_negocio).toBe(`Clínica ${CORRIDA}`)
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

  it('verificar_whitelist_operador distingue operador de cliente y dice su nivel', async () => {
    const telefonoAdmin = `+5939${CORRIDA}33`
    await supabaseAdmin()
      .from('operador_whitelist')
      .insert({ telefono: telefonoAdmin, nombre: `Admin ${CORRIDA}`, nivel: 'admin' })
    const operador = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: telefonoAdmin },
    })
    await supabaseAdmin().from('operador_whitelist').delete().eq('telefono', telefonoAdmin)
    expect(operador.sobre.data).toMatchObject({ es_operador: true, nivel: 'admin' })

    const cliente = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: TELEFONO },
    })
    expect((cliente.sobre.data as { es_operador: boolean }).es_operador).toBe(false)
  })

  it('cada mensaje trae el nombre del negocio con el que se presenta el agente', async () => {
    const { sobre } = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: TELEFONO },
    })
    const data = sobre.data as { negocio: { nombre: string; saludo: string } }

    // El prompt lo lee de aquí: lo que diga Configuración es como se presenta.
    expect(data.negocio.nombre).toBe((await obtenerConfig()).nombre_negocio)
    expect(data.negocio.nombre.trim()).not.toBe('')
  })
})
