import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',  // Standard output directory
    lib: {
      entry: resolve(__dirname, 'src/widget.jsx'),
      name: 'AgiAIChatbot',
      fileName: 'agiai-chatbot',
      formats: ['iife']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        assetFileNames: 'agiai-chatbot.[ext]',
        entryFileNames: 'agiai-chatbot.iife.js'
      }
    }
  }
});