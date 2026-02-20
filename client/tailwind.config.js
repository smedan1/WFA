/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        buy: {
          DEFAULT: '#22c55e',
          dark: '#15803d',
          bg: '#052e16',
          border: '#166534',
        },
        sell: {
          DEFAULT: '#ef4444',
          dark: '#b91c1c',
          bg: '#2d0a0a',
          border: '#991b1b',
        },
        surface: {
          DEFAULT: '#111827',
          elevated: '#1f2937',
          card: '#1a2035',
        },
        accent: '#fbbf24',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-green': 'glowGreen 2s ease-in-out infinite',
        'glow-red': 'glowRed 2s ease-in-out infinite',
      },
      keyframes: {
        glowGreen: {
          '0%, 100%': { boxShadow: '0 0 5px #22c55e33' },
          '50%': { boxShadow: '0 0 20px #22c55e66, 0 0 40px #22c55e22' },
        },
        glowRed: {
          '0%, 100%': { boxShadow: '0 0 5px #ef444433' },
          '50%': { boxShadow: '0 0 20px #ef444466, 0 0 40px #ef444422' },
        },
      },
    },
  },
  plugins: [],
};
