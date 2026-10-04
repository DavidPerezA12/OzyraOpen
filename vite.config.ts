import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Clasifica node_modules en chunks estables.
 *
 * Importante: la forma objeto (`{ react: ['react', ...] }`) hace matching
 * por subcadena y mete `react/jsx-runtime` dentro del chunk `markdown`
 * (por `react-markdown`), forzando su preload inicial y duplicando React.
 * La forma función con límites de paquete evita ese solapamiento.
 */
const manualChunks = (id: string): string | undefined => {
  // Helper de preload de imports dinámicos: debe vivir en un chunk inicial,
  // si no arrastra a preload el primer chunk diferido que lo use.
  if (id === '\0vite/preload-helper.js') {
    return 'react';
  }

  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (
    id.includes('react-markdown') ||
    id.includes('react-syntax-highlighter') ||
    id.includes('remark-') ||
    id.includes('rehype-') ||
    id.includes('micromark') ||
    id.includes('mdast-') ||
    // `hast` cubre hast-*, hastscript y hast-util-parse-selector: partir la
    // familia entre chunks crea aristas estáticas hacia el chunk diferido.
    id.includes('hast') ||
    id.includes('unified') ||
    id.includes('unist-') ||
    id.includes('refractor') ||
    id.includes('lowlight') ||
    id.includes('prismjs') ||
    id.includes('vfile') ||
    id.includes('property-information') ||
    id.includes('web-namespaces') ||
    id.includes('stringify-entities') ||
    id.includes('character-entities') ||
    id.includes('comma-separated-tokens') ||
    id.includes('space-separated-tokens') ||
    id.includes('collapse-white-space') ||
    id.includes('trim-lines') ||
    id.includes('decode-named-character-reference') ||
    id.includes('parse-entities') ||
    id.includes('escape-string-regexp') ||
    id.includes('longest-streak') ||
    id.includes('zwitch') ||
    id.includes('ccount') ||
    id.includes('is-plain-obj') ||
    // Nombres cortos con límites de paquete: `fault` a secas matchearía
    // `defaultAttributes.js` de lucide-react (estático).
    id.includes('/fault/') ||
    id.includes('/bail/') ||
    id.includes('/trough/') ||
    id.includes('/extend/') ||
    id.includes('/devlop/') ||
    id.includes('/dequal/')
  ) {
    return 'markdown';
  }

  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
    return 'react';
  }

  return 'vendor';
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: configDefaults.exclude,
    coverage: {
      reporter: ['text', 'html'],
      exclude: configDefaults.coverage?.exclude,
      thresholds: {
        statements: 65,
        branches: 54,
        functions: 62,
        lines: 66,
      },
    },
  },
});
