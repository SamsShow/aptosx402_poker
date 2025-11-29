import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Comic colors
        comic: {
          yellow: "hsl(var(--comic-yellow))",
          red: "hsl(var(--comic-red))",
          blue: "hsl(var(--comic-blue))",
          green: "hsl(var(--comic-green))",
          purple: "hsl(var(--comic-purple))",
          orange: "hsl(var(--comic-orange))",
          pink: "hsl(var(--comic-pink))",
          cyan: "hsl(var(--comic-cyan))",
        },
        felt: {
          DEFAULT: "#22c55e",
          dark: "#16a34a",
          light: "#4ade80",
        },
        x402: {
          DEFAULT: "#3b82f6",
          dark: "#1d4ed8",
          light: "#60a5fa",
        },
        chip: {
          white: "#f5f5f5",
          red: "#ef4444",
          blue: "#3b82f6",
          green: "#22c55e",
          black: "#171717",
          gold: "#eab308",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Comic Neue", "cursive", "var(--font-sans)"],
        mono: ["var(--font-mono)"],
        comic: ["Bangers", "cursive"],
        body: ["Comic Neue", "cursive"],
      },
      boxShadow: {
        'comic': '4px 4px 0 0 hsl(var(--border))',
        'comic-lg': '6px 6px 0 0 hsl(var(--border))',
        'comic-xl': '8px 8px 0 0 hsl(var(--border))',
        'comic-sm': '2px 2px 0 0 hsl(var(--border))',
        'comic-primary': '4px 4px 0 0 hsl(var(--primary))',
        'comic-yellow': '4px 4px 0 0 hsl(var(--comic-yellow))',
        'comic-red': '4px 4px 0 0 hsl(var(--comic-red))',
        'comic-blue': '4px 4px 0 0 hsl(var(--comic-blue))',
        'comic-green': '4px 4px 0 0 hsl(var(--comic-green))',
      },
      keyframes: {
        "card-deal": {
          "0%": { transform: "translateY(-50px) rotate(-10deg)", opacity: "0" },
          "100%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
        },
        "card-flip": {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(180deg)" },
        },
        "chip-drop": {
          "0%": { transform: "translateY(-30px) rotate(45deg)", opacity: "0" },
          "60%": { transform: "translateY(5px) rotate(-5deg)", opacity: "1" },
          "100%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
        },
        "thought-pop": {
          "0%": { transform: "scale(0) rotate(-5deg)", opacity: "0" },
          "50%": { transform: "scale(1.1) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "comic-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px) rotate(-1deg)" },
          "75%": { transform: "translateX(5px) rotate(1deg)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
      },
      animation: {
        "card-deal": "card-deal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "card-flip": "card-flip 0.3s ease-in-out",
        "chip-drop": "chip-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "thought-pop": "thought-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "comic-shake": "comic-shake 0.3s ease-in-out",
        "bounce-in": "bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-up": "slide-up 0.3s ease-out",
        "wiggle": "wiggle 0.3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
