import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0e7490', // teal-700 — identidade visual Chefe Coruja
          dark: '#155e75',
          light: '#06b6d4',
        },
        accent: {
          DEFAULT: '#eab308', // yellow-500
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
