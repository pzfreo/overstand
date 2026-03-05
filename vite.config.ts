import { defineConfig, type Plugin } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin: patch svg-to-pdfkit so its type checks survive minification.
 *
 * svg-to-pdfkit creates pattern objects via `new (function PDFPattern() {})()`
 * and later checks `obj.constructor.name === 'PDFPattern'`. Minifiers strip
 * named function expressions, breaking this check and causing SVG <pattern>
 * fills to render as solid black. This plugin replaces the fragile
 * constructor.name checks with a minification-safe `_type` property.
 */
function patchSvgToPdfkitTypes(): Plugin {
  return {
    name: 'patch-svg-to-pdfkit-types',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('svg-to-pdfkit')) return
      let result = code

      // Add _type property after pattern construction
      result = result.replace(
        `let pattern = new (function PDFPattern() {})();`,
        `let pattern = new (function PDFPattern() {})(); pattern._type = 'PDFPattern';`,
      )

      // Replace constructor.name checks with _type checks
      result = result.replace(
        /\.constructor\.name\s*===\s*'PDFPattern'/g,
        `._type === 'PDFPattern'`,
      )

      if (result !== code) {
        return { code: result, map: null }
      }
    },
  }
}

/**
 * Vite plugin: inline PDFKit's AFM font metric files at build time.
 *
 * PDFKit's ES module loads built-in font metrics via:
 *   fs.readFileSync(__dirname + '/data/Helvetica.afm', 'utf8')
 *
 * In the browser, neither `fs` nor `__dirname` exist. This plugin replaces
 * those calls with the actual file contents as string literals, so the
 * regular PDFKit ES module works in browsers without the standalone build
 * (which breaks SVG pattern rendering).
 */
function inlinePdfkitAfm(): Plugin {
  const pdfkitDataDir = resolve(__dirname, 'node_modules/pdfkit/js/data')
  return {
    name: 'inline-pdfkit-afm',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('pdfkit')) return
      let result = code

      // Inline AFM font metrics: fs.readFileSync(__dirname + '/data/Font.afm', 'utf8')
      result = result.replace(
        /\w+\.readFileSync\(\s*__dirname\s*\+\s*['"]\/data\/([\w-]+)\.afm['"]\s*,\s*['"]utf8['"]\s*\)/g,
        (_match, fontName) => {
          const afmPath = resolve(pdfkitDataDir, `${fontName}.afm`)
          return JSON.stringify(readFileSync(afmPath, 'utf8'))
        },
      )

      // Inline ICC color profile: fs.readFileSync(`${__dirname}/data/sRGB_IEC61966_2_1.icc`)
      result = result.replace(
        /\w+\.readFileSync\(\s*`\$\{__dirname\}\/data\/([\w_]+\.icc)`\s*\)/g,
        (_match, fileName) => {
          const iccPath = resolve(pdfkitDataDir, fileName)
          const buf = readFileSync(iccPath)
          return `Buffer.from("${buf.toString('base64')}", "base64")`
        },
      )

      if (result !== code) {
        return { code: result, map: null }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isBuild = mode === 'production'

  return {
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
    // No resolve alias — use the regular PDFKit ES module (not standalone).
    // The standalone build breaks SVG <pattern> rendering in svg-to-pdfkit.
    plugins: isBuild
      ? [
          patchSvgToPdfkitTypes(),
          inlinePdfkitAfm(),
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
  }
})
