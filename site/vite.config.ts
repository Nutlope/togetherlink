import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    nitro({
      preset: 'vercel',
      output: {
        dir: '../.vercel/output',
      },
    }),
    tsConfigPaths(),
    tanstackStart({
      prerender: {
        enabled: true,
        // /dashboard reads an auth cookie via a server loader; prerendering it
        // bakes a single static "not authed" snapshot that ignores every
        // visitor's cookie, so login never sticks. Same for its API route.
        filter: ({ path }) => !path.startsWith('/dashboard') && !path.startsWith('/api/'),
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
})
