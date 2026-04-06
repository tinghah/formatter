import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8181,
    proxy: {
      '/api': {
        target: 'http://localhost:5555',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
