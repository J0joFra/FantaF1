import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Down-transpile modern syntax (||=, ?., ??) so older Android WebViews
    // don't white-screen on a parse error.
    target: 'es2019',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // ← this must be here
    },
  },
});
