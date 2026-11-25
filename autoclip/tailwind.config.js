/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F05438',
          'orange-hover': '#D94328',
          blue: '#1BA0D7',
          'blue-hover': '#1489B9',
          'blue-light': '#E0F2FE',
          yellow: '#FBBF24',
          green: '#10B981',
          navy: '#1E293B',
          soft: '#F8FAFC'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'sans-serif']
      },
      boxShadow: {
        'soft': '0 10px 30px -5px rgba(27, 160, 215, 0.08), 0 4px 12px -2px rgba(240, 84, 56, 0.05)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'hover': '0 20px 35px -5px rgba(27, 160, 215, 0.15)',
      }
    },
  },
  plugins: [],
}
