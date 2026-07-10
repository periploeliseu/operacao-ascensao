import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Ponto de entrada: monta o componente App dentro da div #root do index.html
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
