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
          bg: "#0F1117",
          panel: "#1A1D27",
          panel2: "#171A22",
          border: "#2A2D3A",
          text: "#EAEAEA",
          muted: "#7A7F8E",
          dim: "#7A7F8E",
          accent: "#4F8EF7",
          accentHover: "#3D7BE8",
          success: "#3DDC84",
          warning: "#F5A623",
          danger: "#E05252",
          info: "#4F8EF7",
        },
      },
    },
  },
  plugins: [],
};
