import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  markdown: {
    layout: 'src/layouts/MainLayout.astro'
  }
});
