import { ImageResponse } from 'next/og'
import { altoFila, cabeEnUnaLinea, repartirEnColumnas } from '@/server/catalogo/agrupar'
import { datosDelCatalogo } from '@/server/catalogo/repo'

export const dynamic = 'force-dynamic'

const ANCHO = 1080
const ALTO_ENCABEZADO = 200
const ALTO_PIE = 230

const AZUL = '#1f4e79'
const FONDO = '#f4f8fc'

/**
 * El catálogo como imagen, para mandarlo por WhatsApp como foto (no como enlace).
 * Es público a propósito —son los precios que se le dan a cualquier cliente— y se
 * arma en el momento con lo que hay en el CRM: nunca queda desactualizado.
 */
export async function GET() {
  const { negocio, categorias, pie } = await datosDelCatalogo()
  const { columnas, alto } = repartirEnColumnas(categorias, 2)
  const altoTotal = ALTO_ENCABEZADO + alto + ALTO_PIE + 40

  return new ImageResponse(
    <div
      style={{
        width: ANCHO,
        height: altoTotal,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: FONDO,
        fontFamily: 'sans-serif',
        color: '#1b2733',
      }}
    >
      <div
        style={{
          height: ALTO_ENCABEZADO,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 48px',
          backgroundColor: AZUL,
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 66, fontWeight: 700 }}>{negocio}</div>
        <div style={{ display: 'flex', fontSize: 34, marginTop: 8 }}>Lista de precios</div>
      </div>

      <div style={{ display: 'flex', flex: 1, padding: '32px 32px 0 32px' }}>
        {columnas.map((columna) => (
          <div
            key={columna[0]?.titulo ?? 'vacia'}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 16px' }}
          >
            {columna.map((categoria) => (
              <div
                key={categoria.titulo}
                style={{ display: 'flex', flexDirection: 'column', marginBottom: 26 }}
              >
                <div
                  style={{
                    display: 'flex',
                    height: 58,
                    marginBottom: 12,
                    alignItems: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    color: AZUL,
                    borderBottom: `3px solid ${AZUL}`,
                  }}
                >
                  {categoria.titulo}
                </div>
                {categoria.filas.map((fila) => (
                  <div
                    key={fila.nombre}
                    style={{
                      display: 'flex',
                      flexDirection: cabeEnUnaLinea(fila) ? 'row' : 'column',
                      justifyContent: cabeEnUnaLinea(fila) ? 'space-between' : 'center',
                      alignItems: cabeEnUnaLinea(fila) ? 'center' : 'flex-start',
                      minHeight: altoFila(fila),
                    }}
                  >
                    <div style={{ display: 'flex', fontSize: 25, fontWeight: 700 }}>
                      {fila.nombre}
                    </div>
                    <div style={{ display: 'flex', fontSize: 23, color: '#3b4a5a' }}>
                      {fila.detalle}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          height: ALTO_PIE,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 48px',
          backgroundColor: '#e3edf7',
          fontSize: 28,
        }}
      >
        {pie.map((linea) => (
          <div key={linea} style={{ display: 'flex', marginTop: 6 }}>
            {linea}
          </div>
        ))}
      </div>
    </div>,
    {
      width: ANCHO,
      height: altoTotal,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    },
  )
}
