import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig, parametrosVentana } from '@/server/configuracion/repo'
import { plazosPorMetodo } from '@/server/pricing/plazo'
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
  it('calcular_vehiculo: siempre auto, con 1 funda, con 3 o sin decir cuántas', async () => {
    for (const parametros of [{ numero_fundas: 1 }, { numero_fundas: 3 }, {}]) {
      const r = await llamar({ accion: 'calcular_vehiculo', parametros })
      expect((r.sobre.data as { vehiculo: string }).vehiculo).toBe('auto')
    }
  })

  it('verificar_cobertura responde solo sí o no, sin radio ni distancias', async () => {
    const config = await obtenerConfig()
    const r = await llamar({
      accion: 'verificar_cobertura',
      parametros: { sector: 'Cumbayá lejano' },
    })
    expect(r.estado).toBe(200)
    const data = r.sobre.data as Record<string, unknown>
    expect(Object.keys(data)).toEqual(['cubre'])
    if (config.sectores_cobertura.length > 0) {
      expect(data.cubre).toBe(false)
      const dentro = await llamar({
        accion: 'verificar_cobertura',
        parametros: { sector: config.sectores_cobertura[0] },
      })
      expect((dentro.sobre.data as { cubre: boolean }).cubre).toBe(true)
    } else {
      expect(data.cubre).toBeNull()
    }
  })

  it('obtener_proxima_ventana ya no entrega el radio de cobertura al agente', async () => {
    const { sobre } = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })
    expect(sobre.data as Record<string, unknown>).not.toHaveProperty('cobertura')
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

  it('la ventana trae los plazos de entrega por método, los de cada servicio en el CRM', async () => {
    const { sobre } = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })
    const data = sobre.data as { plazos_por_metodo: Record<string, string> }
    const { data: filas } = await supabaseAdmin()
      .from('servicios')
      .select('metodo, plazo_horas')
      .eq('activo', true)

    // Los plazos los edita María Sol en Servicios: se comparan contra la base, no contra un fijo.
    expect(data.plazos_por_metodo).toEqual(
      plazosPorMetodo((filas ?? []) as { metodo: string; plazo_horas: number }[]),
    )
    expect(Object.keys(data.plazos_por_metodo)).toEqual(expect.arrayContaining(['agua', 'seco']))
  })

  it('si el cliente pide otro día, la ventana es la de ESE día', async () => {
    // El agente le dijo a un cliente «para mañana no tenemos ventana» y le
    // confirmó el pedido para hoy. La herramienta sí sabe buscar otro día.
    // Un día de operación a 3–9 días de hoy (no una fecha fija: la prueba vencería sola).
    const dias = (await obtenerConfig()).dias_operacion
    let fecha = ''
    for (let k = 3; k <= 9 && fecha === ''; k++) {
      const quito = new Date(Date.now() - 5 * 3_600_000 + k * 86_400_000)
      const diaSemana = quito.getUTCDay() === 0 ? 7 : quito.getUTCDay()
      if (dias.includes(diaSemana)) fecha = quito.toISOString().slice(0, 10)
    }
    const { sobre } = await llamar({
      accion: 'obtener_proxima_ventana',
      parametros: { desde: fecha },
    })
    const data = sobre.data as { inicio: string; es_hoy: boolean }

    // La ventana cae ese mismo día, en hora de Quito (UTC-5: el inicio sigue siendo ese día en UTC).
    expect(data.inicio).toContain(fecha)
    expect(data.es_hoy).toBe(false)
  })

  it('una fecha vacía o ausente sigue dando la próxima ventana', async () => {
    const vacia = await llamar({ accion: 'obtener_proxima_ventana', parametros: { desde: '' } })
    const sinNada = await llamar({ accion: 'obtener_proxima_ventana', parametros: {} })

    expect(vacia.estado).toBe(200)
    // Se compara el día, no el instante: cuando faltan minutos para el cierre la
    // ventana arranca «ahora + margen» y dos llamadas difieren en segundos. El
    // redondeo a hora en punto se prueba con instantes fijos en tests/unit.
    const lo = (r: typeof vacia) => r.sobre.data as { inicio: string; es_hoy: boolean }
    expect(lo(vacia).inicio.slice(0, 10)).toBe(lo(sinNada).inicio.slice(0, 10))
    expect(lo(vacia).es_hoy).toBe(lo(sinNada).es_hoy)
  })

  it('el agente sabe hasta dónde se recoge y a qué hora abre el local', async () => {
    const { sobre } = await llamar({
      accion: 'verificar_whitelist_operador',
      parametros: { telefono: TELEFONO },
    })
    const negocio = (
      sobre.data as {
        negocio: {
          cobertura: string
          horario: string
          direccion: string
          telefono: string
          enlace_mapa: string
        }
      }
    ).negocio
    const config = await obtenerConfig()

    // Nada de esto está escrito en el prompt: sale de Configuración.
    expect(negocio.cobertura).toContain(String(Number(config.radio_cobertura_km)).replace('.', ','))
    expect(negocio.horario).toContain(config.hora_apertura.slice(0, 5))
    // La dirección, el fijo y el mapa también: el prompt ya no los lleva escritos.
    expect(negocio.direccion).toBe(config.direccion_local)
    expect(negocio.telefono).toBe(config.telefono_local)
    expect(negocio.enlace_mapa).toBe(config.enlace_mapa)
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
    // n8n corta el turno si el gasto del día ya pasó el techo: el campo siempre viene.
    expect(typeof (primera.sobre.data as { costo_excedido: boolean }).costo_excedido).toBe(
      'boolean',
    )

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
