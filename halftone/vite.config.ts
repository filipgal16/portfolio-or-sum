import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the built site works from a domain root, a subfolder
  // on your own server, or Vercel/Netlify, without changing anything.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
