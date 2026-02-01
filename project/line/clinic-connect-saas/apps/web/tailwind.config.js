/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00C300',
          dark: '#009900',
          light: '#66DB66',
        },
        secondary: {
          DEFAULT: '#06C755',
        },
        accent: {
          DEFAULT: '#5B4DFF',
        },
      },
    },
  },
  plugins: [],
};
