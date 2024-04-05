import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig(({ mode }: { mode: string }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/enchanter/' : '/',
}))
