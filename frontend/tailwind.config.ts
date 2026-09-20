import type { Config } from "tailwindcss";

const config: Config = {
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
        // Literal hex values (NOT var()) so Tailwind can compile alpha utilities
        primary: {
          DEFAULT: '#4A0F24', // Master Primary (Deep Burgundy)
          dark: '#320817',    // Master Primary Dark
          hover: '#320817',
          light: '#631833',
          soft: '#F5EBF0'
        },
        gold: {
          DEFAULT: '#C9A45C', // Master Champagne Gold
          light: '#E4C982',   // Master Gold Light
          hover: '#B38C45',
          dark: '#9E762E',
          soft: '#FAF5EA'
        },
        accent: {
          DEFAULT: '#C9A45C', // Master Champagne Gold
          light: '#E4C982',   // Master Gold Light
          hover: '#B38C45',
          soft: '#FAF5EA',
          softHover: '#F4EBDA'
        },
        background: {
          DEFAULT: '#F7F3ED', // Master Background (Warm Ivory)
          card: '#FFFFFF'
        },
        card: '#FFFFFF',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E5DCD2', // Master Border (Warm Linen)
          soft: '#EFE8DF',
          warm: '#E5DCD2'
        },
        burgundy: {
          DEFAULT: '#4A0F24',
          dark: '#320817',
          light: '#631833',
          hover: '#320817'
        },
        champagne: {
          DEFAULT: '#C9A45C',
          dark: '#B38C45',
          light: '#E4C982',
          hover: '#B38C45'
        },
        ivory: {
          DEFAULT: '#F7F3ED',
          card: '#FFFFFF',
          border: '#E5DCD2'
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
          DEFAULT: '#21151A', // Master Main Text
          hover: '#0D080A'
        },
        secondary: {
          DEFAULT: '#6F6265', // Master Secondary Text
          hover: '#4A4143'
        },
        muted: '#6F6265',
        burgundy: '#4A0F24',
        gold: '#C9A45C',
        'gold-light': '#E4C982',
        'primary-hover': '#0D080A'
      }
    },
  },
  plugins: [],
};
export default config;
