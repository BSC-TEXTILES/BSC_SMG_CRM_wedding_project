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
        // BSC Exclusive Wedding CRM Brand Color System
        primary: {
          DEFAULT: '#4A173A', // Deep Plum (Primary Brand)
          dark: '#351027',    // Dark Plum
          medium: '#6A2853',  // Medium Plum
          hover: '#6A2853',   // Primary Button / Nav Hover
          light: '#6A2853',
          soft: '#FFF7F2'     // Soft Cream
        },
        plum: {
          DEFAULT: '#4A173A', // Deep Plum
          dark: '#351027',    // Dark Plum
          medium: '#6A2853',  // Medium Plum
          dusty: '#8B5A72',   // Dusty Plum
          soft: '#FFF7F2'     // Soft Cream
        },
        rosegold: {
          DEFAULT: '#B76E79', // Rose Gold (Primary Accent)
          light: '#D89AA3',   // Light Rose Gold
          hover: '#A85F6A',   // Secondary Button Hover
          mauve: '#C9A0AA',   // Soft Mauve
          soft: '#F6E2E5'
        },
        accent: {
          DEFAULT: '#B76E79', // Rose Gold (Primary Accent)
          light: '#D89AA3',   // Light Rose Gold
          hover: '#A85F6A',   // Secondary Button Hover
          dark: '#6A2853',    // Medium Plum
          soft: '#FFF7F2',    // Soft Cream
          softHover: '#F6E2E5'
        },
        gold: {
          DEFAULT: '#B76E79', // Mapped to Rose Gold for brand consistency
          light: '#D89AA3',   // Light Rose Gold
          hover: '#A85F6A',
          dark: '#4A173A',    // Deep Plum
          champagne: '#E8C7A8',
          soft: '#FFF7F2'
        },
        champagne: {
          DEFAULT: '#E8C7A8', // Champagne Accent
          light: '#FFF7F2',
          hover: '#DFBC9D',
          dark: '#B76E79'
        },
        background: {
          DEFAULT: '#FFF7F2', // Soft Cream
          card: '#FFFDFC',    // Card / Surface
          cream: '#FFF7F2'
        },
        card: '#FFFDFC',      // Card / Surface
        surface: '#FFFDFC',   // Card / Surface
        border: {
          DEFAULT: '#E8D9D4', // UI Border
          divider: '#EADBD7', // UI Divider
          soft: '#E8D9D4',
          warm: '#E8D9D4'
        },
        divider: '#EADBD7',
        input: {
          bg: '#FFFAF7',      // Input Background
          border: '#E8D9D4',
          focus: '#B76E79'
        },
        navy: {
          DEFAULT: '#4A173A', // Mapped to Deep Plum
          dark: '#351027',    // Dark Plum
          light: '#6A2853',   // Medium Plum
          hover: '#6A2853'
        },
        burgundy: {
          DEFAULT: '#4A173A', // Deep Plum
          dark: '#351027',
          light: '#6A2853',
          hover: '#6A2853'
        },
        cream: {
          DEFAULT: '#FFF7F2', // Soft Cream
          card: '#FFFDFC',
          border: '#E8D9D4'
        },
        ivory: {
          DEFAULT: '#FFF7F2',
          card: '#FFFDFC',
          border: '#E8D9D4'
        },
        status: {
          success: '#198754',         // Confirmed / Success
          'success-light': '#E8F5EE',
          warning: '#C58A18',         // Pending / Warning
          'warning-light': '#FFF4D6',
          danger: '#B42318',          // Cancelled / Error
          'danger-light': '#FDE8E7',
          info: '#356AE6',            // Information
          'info-light': '#EAF1FA',
          neutral: '#737373',         // Neutral
          interested: '#6A2853',      // Interested CRM Status
          'interested-light': '#EDE7F6',
          followup: '#4A173A',        // Follow-up CRM Status
          'followup-light': '#F6E2E5'
        }
      },
      textColor: {
        primary: {
          DEFAULT: '#2B1722', // Primary Text
          hover: '#4A173A'
        },
        secondary: {
          DEFAULT: '#6F5963', // Secondary Text
          hover: '#2B1722'
        },
        muted: '#9A858D',     // Muted Text
        plum: '#4A173A',      // Deep Plum
        rosegold: '#B76E79',  // Rose Gold
        champagne: '#E8C7A8', // Champagne
        navy: '#4A173A',      // Alias
        gold: '#B76E79',      // Alias to Rose Gold
        'gold-light': '#D89AA3',
        'primary-hover': '#4A173A'
      }
    },
  },
  plugins: [],
};
export default config;
