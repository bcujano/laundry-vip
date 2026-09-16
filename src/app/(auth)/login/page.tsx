'use client'

import { useActionState } from 'react'
import { type EstadoLogin, enviarEnlace } from './actions'

const INICIAL: EstadoLogin = {}

export default function Login() {
  const [estado, accion, pendiente] = useActionState(enviarEnlace, INICIAL)

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Lavandería VIP</h1>
      <p className="mt-1 text-sm text-[var(--color-texto-apagado)]">
        Entra con tu correo. Te enviamos un enlace de acceso.
      </p>

      {estado.enviado ? (
        <p
          className="mt-6 rounded-[var(--radius-tarjeta)] border border-[var(--color-borde)] bg-[var(--color-superficie)] p-4 text-sm"
          role="status"
        >
          Si ese correo tiene una cuenta, el enlace ya va en camino. Revisa tu bandeja.
        </p>
      ) : (
        <form action={accion} className="mt-6 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Correo
          </label>
          <input
            autoComplete="email"
            className="rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-3 py-2 text-sm"
            id="email"
            name="email"
            required
            type="email"
          />
          {estado.error ? (
            <p className="text-sm text-[var(--color-destructivo)]" role="alert">
              {estado.error}
            </p>
          ) : null}
          <button
            className="rounded-[var(--radius-control)] bg-[var(--color-primario)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={pendiente}
            type="submit"
          >
            {pendiente ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </main>
  )
}
