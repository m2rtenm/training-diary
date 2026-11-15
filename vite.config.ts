import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const runtime = globalThis as typeof globalThis & { process: { cwd(): string } }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, runtime.process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    define: {
      __COGNITO_AUTHORITY__: JSON.stringify(env.VITE_COGNITO_AUTHORITY ?? ''),
      __COGNITO_CLIENT_ID__: JSON.stringify(env.VITE_COGNITO_CLIENT_ID ?? ''),
      __COGNITO_HOSTED_UI__: JSON.stringify(env.VITE_COGNITO_HOSTED_UI ?? ''),
    },
  }
})
