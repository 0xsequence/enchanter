import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { execSync } from 'child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
const isDirty = execSync('git diff-index --quiet HEAD --; echo $?').toString().trim() !== '0'
const fullCommitHash = isDirty ? `${commitHash} (dirty)` : commitHash

export default defineConfig(({ mode }: { mode: string }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/enchanter/' : '/',
  define: {
    __COMMIT_HASH__: JSON.stringify(fullCommitHash)
  }
}))
