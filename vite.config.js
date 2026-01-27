import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  root: 'src',
  build: {
    outDir: '../dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './src/index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    host: true
  },
  preview: {
    port: 3000,
    host: true
  },
  optimizeDeps: {
    include: ['@stacks/transactions', '@stacks/common'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      process: 'process/browser',
      util: 'util/'
    }
  }
});
