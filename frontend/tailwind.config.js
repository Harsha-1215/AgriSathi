/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-green': '#166534',
        'secondary-green': '#22C55E',
        'light-green': '#DCFCE7',
        'dark-green': '#14532D',
        'background': '#F8FAF7',
        'card-background': '#FFFFFF',
        'primary-text': '#172B1D',
        'secondary-text': '#64748B',
        'warning': '#F59E0B',
        'danger': '#DC2626',
        'success': '#16A34A',
      },
    },
  },
  plugins: [],
};