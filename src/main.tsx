import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  // Mensagem clara se o template HTML estiver corrompido.
  document.body.innerHTML =
    '<pre style="padding:24px;color:#a00;font-family:ui-monospace,monospace;">[MindCare] Elemento #root não encontrado em index.html.</pre>';
} else {
  createRoot(rootEl).render(<App />);
}
