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
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Inter', 'sans-serif'],
      },
      blur: { xs: '2px' },
      backdropBlur: { xs: '2px' },
      colors: {
        // BSC Exclusive Enterprise Suite Brand Color System
        // Forest Green + Champagne Gold + Warm Cream
        primary: {
          DEFAULT: '#123C35', // Forest Green (Primary Brand)
          dark: '#0B2924',    // Deep Forest
          medium: '#1D5148',  // Primary Medium
          hover: '#0B2924',   // Primary Button / Nav Hover
          light: '#1D5148',   // Primary Light
          soft: '#EDF3F0'     // Hover / Mint Tint
        },
        forest: {
          DEFAULT: '#123C35',
          dark: '#0B2924',
          light: '#1D5148',
          soft: '#EDF3F0'
        },
        champagne: {
          DEFAULT: '#C9A45C', // Champagne Gold (Primary Accent)
          light: '#E4CB92',   // Light Champagne
          soft: '#F7F4ED',    // Warm Cream
          hover: '#B88F45',   // Champagne Hover
          dark: '#0B2924'
        },
        gold: {
          DEFAULT: '#C9A45C', // Champagne Gold
          light: '#E4CB92',   // Light Champagne
          soft: '#F7F4ED',    // Warm Cream
          hover: '#B88F45',
          dark: '#0B2924',
          champagne: '#C9A45C'
        },
        accent: {
          DEFAULT: '#C9A45C', // Champagne Gold
          light: '#E4CB92',   // Light Champagne
          soft: '#F7F4ED',    // Warm Cream
          hover: '#B88F45',
          dark: '#0B2924',
          softHover: '#EDF3F0'
        },
        // Legacy aliases mapped cleanly to Forest Green & Champagne Gold
        plum: {
          DEFAULT: '#123C35',
          dark: '#0B2924',
          medium: '#1D5148',
          dusty: '#1D5148',
          soft: '#EDF3F0'
        },
        rosegold: {
          DEFAULT: '#C9A45C',
          light: '#E4CB92',
          hover: '#B88F45',
          mauve: '#E4CB92',
          soft: '#F7F4ED'
        },
        navy: {
          DEFAULT: '#123C35',
          dark: '#0B2924',
          light: '#1D5148',
          hover: '#0B2924'
        },
        burgundy: {
          DEFAULT: '#123C35',
          dark: '#0B2924',
          light: '#1D5148',
          hover: '#0B2924'
        },
        background: {
          DEFAULT: '#F7F4ED', // Warm Cream
          card: '#FFFFFF',    // Pure White Card
          cream: '#F7F4ED'
        },
        card: '#FFFFFF',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E2DDD2', // UI Border
          divider: '#E2DDD2', // UI Divider
          soft: '#E2DDD2',
          warm: '#E2DDD2'
        },
        divider: '#E2DDD2',
        hover: {
          DEFAULT: '#EDF3F0'  // Subtle Hover Tint
        },
        input: {
          bg: '#FFFFFF',      // Pure White Input
          border: '#E2DDD2',
          focus: '#123C35'
        },
        cream: {
          DEFAULT: '#F7F4ED',
          card: '#FFFFFF',
          border: '#E2DDD2'
        },
        ivory: {
          DEFAULT: '#F7F4ED',
          card: '#FFFFFF',
          border: '#E2DDD2'
        },
        status: {
          success: '#15803D',         // Success
          'success-light': '#DCFCE7',
          warning: '#B7791F',         // Warning
          'warning-light': '#FEF3C7',
          danger: '#C62828',          // Danger
          'danger-light': '#FEE2E2',
          info: '#2563EB',            // Info
          'info-light': '#DBEAFE',
          neutral: '#687080',         // Neutral
          interested: '#123C35',      // Forest Green
          'interested-light': '#EDF3F0',
          followup: '#C9A45C',        // Champagne Gold
          'followup-light': '#FEF3C7'
        }
      },
      textColor: {
        primary: {
          DEFAULT: '#182033', // Primary Text
          hover: '#123C35'
        },
        secondary: {
          DEFAULT: '#687080', // Secondary Text
          hover: '#182033'
        },
        muted: '#8A919B',     // Muted Text
        plum: '#123C35',      // Forest Green
        rosegold: '#C9A45C',  // Champagne Gold
        champagne: '#C9A45C', // Champagne Gold
        navy: '#123C35',      // Forest Green
        gold: '#C9A45C',      // Champagne Gold
        'gold-light': '#E4CB92',
        'primary-hover': '#0B2924'
      }
    },
  },
  plugins: [],
};
export default config;
