import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração do Vite: o plugin react ensina o Vite a compilar JSX.
export default defineConfig({
  plugins: [react()],
});
