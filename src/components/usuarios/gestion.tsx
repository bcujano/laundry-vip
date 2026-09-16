'use client'

import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import { useActionState, useState } from 'react'
import {
  borrarUsuario,
  cambiarEstadoUsuario,
  cambiarMiPassword,
  cambiarRolUsuario,
  crearUsuario,
  type EstadoUsuarios,
  reiniciarPassword,
} from '@/app/(dashboard)/usuarios/actions'
import {
  Aviso,
  Boton,
  BotonAccion,
  CabeceraTarjeta,
  Campo,
  Etiqueta,
  Etiquetado,
  Seleccion,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '@/components/ui/primitivos'
import type { RolStaff } from '@/types/database'

const INICIAL: EstadoUsuarios = {}

const ROLES: { valor: RolStaff; texto: string; explicacion: string }[] = [
  { valor: 'superadmin', texto: 'Super Admin', explicacion: 'Todo, incluidas cuentas y borrados' },
  { valor: 'admin', texto: 'Admin', explicacion: 'Todo menos precios y configuración' },
  { valor: 'operador', texto: 'Operador', explicacion: 'Pedidos y clientes' },
]

export type FilaUsuario = {
  id: string
  authUserId: string
  email: string
  nombre: string
  rol: RolStaff
  activo: boolean
  esYo: boolean
}

export function FormularioNuevoUsuario() {
  const [estado, accion, pendiente] = useActionState(crearUsuario, INICIAL)

  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Crear cuenta" />
      <form action={accion} className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Etiquetado para="nuevo-nombre" texto="Nombre completo">
            <Campo id="nuevo-nombre" name="nombre_completo" placeholder="Rosa Pérez" required />
          </Etiquetado>
          <Etiquetado para="nuevo-email" texto="Correo">
            <Campo
              autoComplete="off"
              id="nuevo-email"
              name="email"
              placeholder="persona@correo.com"
              required
              type="email"
            />
          </Etiquetado>
          <Etiquetado para="nuevo-rol" texto="Rol">
            <Seleccion defaultValue="operador" id="nuevo-rol" name="rol">
              {ROLES.map((rol) => (
                <option key={rol.valor} value={rol.valor}>
                  {rol.texto} — {rol.explicacion}
                </option>
              ))}
            </Seleccion>
          </Etiquetado>
          <Etiquetado para="nuevo-password" texto="Contraseña provisional">
            <Campo
              autoComplete="new-password"
              id="nuevo-password"
              minLength={8}
              name="password"
              placeholder="mínimo 8 caracteres"
              required
              type="password"
            />
          </Etiquetado>
        </div>

        <p className="text-[var(--texto-suave)] text-xs">
          Dile la contraseña a la persona y que la cambie al entrar, desde «Mi contraseña».
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Boton disabled={pendiente} type="submit">
            <UserPlus size={16} />
            {pendiente ? 'Creando…' : 'Crear cuenta'}
          </Boton>
          <Aviso estado={estado} />
        </div>
      </form>
    </Tarjeta>
  )
}

function ReiniciarPassword({ authUserId }: { authUserId: string }) {
  const [valor, setValor] = useState('')

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Campo
        aria-label="Nueva contraseña"
        className="w-40"
        minLength={8}
        onChange={(evento) => setValor(evento.target.value)}
        placeholder="nueva contraseña"
        type="password"
        value={valor}
      />
      <BotonAccion
        icono={<KeyRound size={14} />}
        onEjecutar={async () => {
          const resultado = await reiniciarPassword(authUserId, valor)
          if (!resultado.error) setValor('')
          return resultado
        }}
        texto="Reiniciar"
      />
    </span>
  )
}

export function TablaUsuarios({ usuarios }: { usuarios: FilaUsuario[] }) {
  return (
    <Tarjeta>
      <CabeceraTarjeta titulo={`Cuentas (${usuarios.length})`} />
      <Tabla>
        <thead>
          <tr>
            <Th>Persona</Th>
            <Th>Correo</Th>
            <Th>Rol</Th>
            <Th>Estado</Th>
            <Th>Contraseña</Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <Td>
                {usuario.nombre}
                {usuario.esYo ? (
                  <span className="ml-2 text-[var(--texto-suave)] text-xs">(tú)</span>
                ) : null}
              </Td>
              <Td className="text-[var(--texto-suave)]">{usuario.email}</Td>
              <Td>
                <Seleccion
                  aria-label={`Rol de ${usuario.nombre}`}
                  className="w-36"
                  defaultValue={usuario.rol}
                  onChange={(evento) => {
                    void cambiarRolUsuario(usuario.id, evento.target.value)
                  }}
                >
                  {ROLES.map((rol) => (
                    <option key={rol.valor} value={rol.valor}>
                      {rol.texto}
                    </option>
                  ))}
                </Seleccion>
              </Td>
              <Td>
                <Etiqueta tono={usuario.activo ? 'exito' : 'neutro'}>
                  {usuario.activo ? 'Activo' : 'Inactivo'}
                </Etiqueta>
              </Td>
              <Td>
                <ReiniciarPassword authUserId={usuario.authUserId} />
              </Td>
              <Td>
                <span className="flex flex-wrap gap-2">
                  <BotonAccion
                    onEjecutar={() => cambiarEstadoUsuario(usuario.id, !usuario.activo)}
                    texto={usuario.activo ? 'Desactivar' : 'Reactivar'}
                  />
                  {usuario.esYo ? null : (
                    <BotonAccion
                      confirmacion={`¿Borrar la cuenta de ${usuario.nombre} (${usuario.email})? No se puede deshacer.`}
                      icono={<Trash2 size={14} />}
                      onEjecutar={() => borrarUsuario(usuario.id)}
                      texto="Borrar"
                      variante="peligro"
                    />
                  )}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </Tarjeta>
  )
}

export function MiPassword() {
  const [estado, accion, pendiente] = useActionState(cambiarMiPassword, INICIAL)

  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Mi contraseña" />
      <form action={accion} className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Etiquetado para="mi-password" texto="Nueva contraseña">
            <Campo
              autoComplete="new-password"
              id="mi-password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </Etiquetado>
          <Etiquetado para="mi-password-repetir" texto="Repítela">
            <Campo
              autoComplete="new-password"
              id="mi-password-repetir"
              minLength={8}
              name="repetir"
              required
              type="password"
            />
          </Etiquetado>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Boton disabled={pendiente} type="submit" variante="suave">
            <KeyRound size={16} />
            {pendiente ? 'Guardando…' : 'Cambiar mi contraseña'}
          </Boton>
          <Aviso estado={estado} />
        </div>
      </form>
    </Tarjeta>
  )
}
