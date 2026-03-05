import { defineConfig } from 'vite'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = import.meta.dirname

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: {
        instrument_generator: resolve(__dirname, 'src-ts/instrument_generator.ts'),
        pdf_generator: resolve(__dirname, 'src-ts/pdf/index.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
  // Only apply polyfills during production build — not during tests.
  // PDFKit needs Buffer, stream, zlib for browser but tests run in Node.
  plugins:
    mode === 'production'
      ? [
          nodePolyfills({
            include: ['buffer', 'stream', 'util', 'events', 'process', 'string_decoder', 'zlib'],
            globals: {
              Buffer: true,
              process: true,
            },
          }),
        ]
      : [],
  test: {
    projects: [
      {
        test: {
          name: 'ts',
          include: ['src-ts/**/*.test.ts'],
          globals: true,
        },
      },
      {
        test: {
          name: 'web',
          include: ['web/**/*.test.js'],
          globals: true,
          environment: 'jsdom',
          setupFiles: ['web/test-setup.js'],
        },
      },
    ],
  },
}))
