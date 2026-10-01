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
      // `xs` is used by ~50 modal/overlay backdrops across the app but is not in
      // Tailwind's default blur scale, so `backdrop-blur-xs` compiled to nothing
      // and those background layers silently rendered no blur at all.
      blur: { xs: '2px' },
      backdropBlur: { xs: '2px' },
      colors: {
        // BSC Exclusive Enterprise Suite Brand Color System
        // Forest Green + Champagne Gold
        primary: {
          DEFAULT: '#123C35', // Forest Green (Primary Brand)
          dark: '#082821',    // Primary Dark
          medium: '#1D5148',  // Primary Light / Medium
          hover: '#082821',   // Primary Button / Nav Hover
          light: '#1D5148',   // Primary Light
          soft: '#EDF3F0'     // Hover / Mint Tint
        },
        forest: {
          DEFAULT: '#123C35',
          dark: '#082821',
          light: '#1D5148',
          soft: '#EDF3F0'
        },
        champagne: {
          DEFAULT: '#C9A45C', // Champagne Gold (Primary Accent)
          light: '#E4CB92',   // Light Champagne
          soft: '#F1E4C4',    // Soft Gold
          hover: '#B88F45',   // Champagne Hover
          dark: '#123C35'
        },
        gold: {
          DEFAULT: '#C9A45C', // Champagne Gold
          light: '#E4CB92',   // Light Champagne
          soft: '#F1E4C4',    // Soft Gold
          hover: '#B88F45',
          dark: '#123C35',
          champagne: '#C9A45C'
        },
        accent: {
          DEFAULT: '#C9A45C', // Champagne Gold
          light: '#E4CB92',   // Light Champagne
          soft: '#F1E4C4',    // Soft Gold
          hover: '#B88F45',
          dark: '#123C35',
          softHover: '#EDF3F0'
        },
        // Legacy aliases mapped cleanly to Forest Green & Champagne Gold
        plum: {
          DEFAULT: '#123C35',
          dark: '#082821',
          medium: '#1D5148',
          dusty: '#1D5148',
          soft: '#EDF3F0'
        },
        rosegold: {
          DEFAULT: '#C9A45C',
          light: '#E4CB92',
          hover: '#B88F45',
          mauve: '#E4CB92',
          soft: '#F1E4C4'
        },
        navy: {
          DEFAULT: '#123C35',
          dark: '#082821',
          light: '#1D5148',
          hover: '#082821'
        },
        burgundy: {
          DEFAULT: '#123C35',
          dark: '#082821',
          light: '#1D5148',
          hover: '#082821'
        },
        background: {
          DEFAULT: '#F7F5F0', // Warm Off-White
          card: '#FFFFFF',    // Pure White Card
          cream: '#F7F5F0'
        },
        card: '#FFFFFF',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E1DDD3', // UI Border
          divider: '#E1DDD3', // UI Divider
          soft: '#E1DDD3',
          warm: '#E1DDD3'
        },
        divider: '#E1DDD3',
        hover: {
          DEFAULT: '#EDF3F0'  // Subtle Hover Tint
        },
        input: {
          bg: '#FFFFFF',      // Pure White Input
          border: '#E1DDD3',
          focus: '#C9A45C'
        },
        cream: {
          DEFAULT: '#F7F5F0',
          card: '#FFFFFF',
          border: '#E1DDD3'
        },
        ivory: {
          DEFAULT: '#F7F5F0',
          card: '#FFFFFF',
          border: '#E1DDD3'
        },
        status: {
          success: '#16805C',         // Success
          'success-light': '#E5F4EE',
          warning: '#C58A16',         // Warning
          'warning-light': '#FEF7E6',
          danger: '#C83B4A',          // Danger
          'danger-light': '#FCECEE',
          info: '#2864C7',            // Info
          'info-light': '#EBF1FB',
          neutral: '#65716C',         // Neutral
          interested: '#123C35',      // Forest Green
          'interested-light': '#EDF3F0',
          followup: '#C9A45C',        // Champagne Gold
          'followup-light': '#F1E4C4'
        }
      },
      textColor: {
        primary: {
          DEFAULT: '#17201D', // Primary Text
          hover: '#123C35'
        },
        secondary: {
          DEFAULT: '#65716C', // Secondary Text
          hover: '#17201D'
        },
        muted: '#8A9691',     // Muted Text
        plum: '#123C35',      // Forest Green
        rosegold: '#C9A45C',  // Champagne Gold
        champagne: '#C9A45C', // Champagne Gold
        navy: '#123C35',      // Forest Green
        gold: '#C9A45C',      // Champagne Gold
        'gold-light': '#E4CB92',
        'primary-hover': '#082821'
      }
    },
  },
  plugins: [],
};
export default config;
