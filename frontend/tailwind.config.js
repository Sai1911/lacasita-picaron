/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ámbar / miel de picarón — color principal de la marca
        brand: {
          50: "#fff8ed",
          100: "#ffefd3",
          200: "#fedba6",
          300: "#fdc06d",
          400: "#fb9d3c",
          500: "#f97e15",
          600: "#ea640b",
          700: "#c24a0b",
          800: "#9a3b11",
          900: "#7c3211",
        },
        // Terracota / rojo especias — acentos y estados de alerta suaves
        terracota: {
          50: "#fdf4f0",
          100: "#fbe6dc",
          500: "#c0532e",
          600: "#a8421f",
          700: "#8a3419",
        },
        // Fondo crema cálido en lugar de gris frío
        crema: "#fbf6ee",
        // Marrón oscuro para cabeceras
        carbon: "#231a15",
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
        logo: ["Pacifico", "cursive"],
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(124, 50, 17, 0.15)",
        card: "0 2px 12px -2px rgba(124, 50, 17, 0.12)",
      },
    },
  },
  plugins: [],
}
