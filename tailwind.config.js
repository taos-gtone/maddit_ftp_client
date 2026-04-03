/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0078D7', hover: '#005A9E', light: '#CCE4F7' },
        secondary: { DEFAULT: '#065fd4', hover: '#0550b0', light: '#def1ff' },
        text: { DEFAULT: '#1E1E1E', sub: '#6E6E6E', muted: '#aaaaaa' },
        surface: '#F5F5F5',
        bg: '#ffffff',
        border: { DEFAULT: '#D0D0D0', light: '#EAEAEA' },
        success: '#2e7d32',
        warning: '#f57c00',
        error: '#d32f2f',
        statusbar: '#007ACC',
        selection: '#CCE8FF',
        hover: '#E5F1FB',
      },
      fontFamily: {
        sans: ['Gulimche', 'Gulim', 'Malgun Gothic', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
      },
    },
  },
  plugins: [],
}
