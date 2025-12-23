/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './app.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bgPrimary: '#0F172A',    // deep blue-grey
        card: '#111827',          // card background
        textPrimary: '#E5E7EB',  // main text
        textSecondary: '#9CA3AF', // secondary text
        accent: '#A5B4FC',        // gentle indigo
      },
    },
  },
  plugins: [],
}
