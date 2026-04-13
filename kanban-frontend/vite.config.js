import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // or react-swc
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    // This fixes the "global is not defined" error for SockJS
    global: 'window',
  },
})