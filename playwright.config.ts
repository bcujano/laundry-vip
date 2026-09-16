import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Las mismas credenciales que usa la aplicación, no una copia que se desincroniza.
const archivoEnv = resolve(import.meta.dirname, '.env.local')
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv)

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const ESTADO_SESION = resolve(import.meta.dirname, 'tests/e2e/.sesion.json')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'preparar', testMatch: /sesion\.setup\.ts/ },
    {
      name: 'panel',
      dependencies: ['preparar'],
      use: { ...devices['Desktop Chrome'], storageState: ESTADO_SESION },
      testIgnore: /(sesion\.setup|anonimo\.spec)\.ts/,
    },
    {
      // Sin sesión a propósito: prueba la redirección al login.
      name: 'anonimo',
      testMatch: /anonimo\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
