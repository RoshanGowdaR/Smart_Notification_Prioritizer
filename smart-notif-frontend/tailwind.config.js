export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        surface: '#111111',
        primary: '#4F46E5',
        accent: '#06B6D4',
        danger: '#E11D48',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px #4F46E5, 0 0 20px #4F46E5' },
          '100%': { boxShadow: '0 0 20px #06B6D4, 0 0 30px #06B6D4' },
        }
      }
    },
  },
  plugins: [],
}

