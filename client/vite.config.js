import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget.jsx'),
      name: 'AgiAIChatbot',
      fileName: 'agiai-chatbot',
      formats: ['iife'] // Immediately Invoked Function Expression
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        assetFileNames: 'agiai-chatbot.[ext]'
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});