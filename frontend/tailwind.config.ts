import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '420px',      // small phones — used by Topbar for the location strip
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        // Literal hex values for Midnight Navy + Champagne Gold Enterprise Theme
        primary: {
          DEFAULT: '#101C36', // Master Primary (Midnight Navy)
          dark: '#07101F',    // Master Primary Dark
          hover: '#07101F',
          light: '#1C2E56',
          soft: '#EEF2F9'
        },
        gold: {
          DEFAULT: '#C9A45C', // Master Champagne Gold
          light: '#E4CB92',   // Master Gold Light
          hover: '#B38C45',
          dark: '#9E762E',
          soft: '#FAF5EA'
        },
        accent: {
          DEFAULT: '#C9A45C', // Master Champagne Gold
          light: '#E4CB92',   // Master Gold Light
          hover: '#B38C45',
          soft: '#FAF5EA',
          softHover: '#F4EBDA'
        },
        background: {
          DEFAULT: '#F6F4EF', // Master Background (Warm Off-white / Ivory)
          card: '#FFFFFF'
        },
        card: '#FFFFFF',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#DFDDD7', // Master Border (Enterprise Subtle Border)
          soft: '#EAE8E3',
          warm: '#DFDDD7'
        },
        navy: {
          DEFAULT: '#101C36',
          dark: '#07101F',
          light: '#1C2E56',
          hover: '#07101F'
        },
        champagne: {
          DEFAULT: '#C9A45C',
          dark: '#9E762E',
          light: '#E4CB92',
          hover: '#B38C45'
        },
        burgundy: {
          // Backward-compatibility alias mapped to Midnight Navy
          DEFAULT: '#101C36',
          dark: '#07101F',
          light: '#1C2E56',
          hover: '#07101F'
        },
        ivory: {
          DEFAULT: '#F6F4EF',
          card: '#FFFFFF',
          border: '#DFDDD7'
        },
        status: {
          success: '#16805B', // Master Success
          warning: '#C98218', // Master Warning
          danger: '#C7374A',  // Master Danger
          info: '#3567A8'     // Master Info
        }
      },
      textColor: {
        primary: {
          DEFAULT: '#182033', // Master Main Text
          hover: '#07101F'
        },
        secondary: {
          DEFAULT: '#687080', // Master Secondary / Muted Text
          hover: '#182033'
        },
        muted: '#687080',
        navy: '#101C36',
        gold: '#C9A45C',
        'gold-light': '#E4CB92',
        'primary-hover': '#07101F'
      }
    },
  },
  plugins: [],
};
export default config;
