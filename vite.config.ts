import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src-ts/instrument_generator.ts'),
      formats: ['es'],
      fileName: 'instrument_generator',
    },
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    include: ['src-ts/**/*.test.ts'],
    globals: true,
  },
})
