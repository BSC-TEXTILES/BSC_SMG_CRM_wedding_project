import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '375px',      // Mobile phones
      sm: '576px',      // Mobile landscape
      md: '768px',      // Tablet portrait
      lg: '992px',      // Tablet landscape / Samsung Tab 12-inch
      xl: '1200px',     // Large laptop
      '2xl': '1440px'   // Desktop
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
          'success-light': '#E8F5EF',
          warning: '#C98218', // Master Warning
          'warning-light': '#FFF4DD',
          danger: '#C7374A',  // Master Danger
          'danger-light': '#FDEBED',
          info: '#3567A8',     // Master Info
          'info-light': '#EAF1FA'
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
