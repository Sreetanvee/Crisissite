/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0e14',
          900: '#0e131b',
          850: '#121924',
          800: '#171f2c',
          700: '#212b3a',
          600: '#2c3a4d',
          500: '#3d4f68',
        },
        signal: {
          amber: '#e0a63c',
          rust: '#c4553a',
          teal: '#3f8f8a',
        },
        flood: {
          low: '#4c9a7b',
          medium: '#e0a63c',
          high: '#c4553a',
        },
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
