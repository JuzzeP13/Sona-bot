/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e5e7eb",
        paper: "#0b1120",
        leaf: "#3fb68f",
        coral: "#f4725c",
        steel: "#94a3b8"
      }
    }
  },
  plugins: []
};
