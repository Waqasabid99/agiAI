import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
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
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({})
  }
});