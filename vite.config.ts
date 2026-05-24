import { fileURLToPath, URL } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [vue(), vueDevTools(), cloudflare()],
    envPrefix: ['VITE_', 'ROOT_URL'],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
