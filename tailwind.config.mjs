/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        carbon: '#1a1a1a',
        terracotta: '#9e2a2b',
        wood: '#d4a574',
        cream: '#fffaf0',
        gold: '#d4af37',
      },
    },
  },
  plugins: [],
}
