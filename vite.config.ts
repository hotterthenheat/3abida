import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // One React, always — guards against mixed pre-bundle generations
    // ("Invalid hook call") when deps are installed mid-flight.
    dedupe: ['react', 'react-dom'],
  },
  define: {
    // react-draggable 4.7 (via react-grid-layout) reads process.env in the
    // browser and throws ReferenceError on every drag without this shim.
    'process.env': {},
  },
});
