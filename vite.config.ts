import { defineConfig } from 'vite';

// Relative base: the same build works on localhost and on GitHub Pages (/<repo>/).
export default defineConfig({
  base: './',
});
