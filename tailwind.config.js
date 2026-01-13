/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,html}",
    "./*.html",
    "./*.html",
    "./*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f4ff',
          100: '#b3e0ff',
          200: '#80ccff',
          300: '#4db8ff',
          400: '#1aa3ff',
          500: '#2B9FD9',
          600: '#2286bd',
          700: '#1a6d9f',
          800: '#125480',
          900: '#0a3b62',
        },
        secondary: {
          50: '#e8eef3',
          100: '#c1d1e0',
          200: '#99b4cd',
          300: '#7297ba',
          400: '#4a7aa7',
          500: '#2F5F87', 
          600: '#264d6e',
          700: '#1e3b54',
          800: '#15293b',
          900: '#0d1721',
        },
        accent: {
          light: '#9CA3AF',
          DEFAULT: '#6B7280',
          dark: '#4B5563',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'Poppins', 'sans-serif'], 
        serif: ['Playfair Display', 'Georgia', 'serif'], 
      },
    },
  },
  plugins: [],
}