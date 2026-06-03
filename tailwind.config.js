/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./renderer/**/*.{html,js}",
    "./main.js",
    "./preload.js",
  ],
  theme: {
    extend: {
      colors: {
        flashfix: {
          bg: "#0B1020",
          panel: "#111827",
          panel2: "#151C2E",
          border: "#243047",
          text: "#E5E7EB",
          muted: "#9CA3AF",
          dim: "#6B7280",
          accent: "#818CF8",
          accentHover: "#6366F1",
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#38BDF8",
        },
      },
      boxShadow: {
        soft: "0 12px 40px rgba(0, 0, 0, 0.28)",
        insetSoft: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
      },
      backgroundImage: {
        'grid-soft': "linear-gradient(to right, rgba(36,48,71,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(36,48,71,0.12) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
