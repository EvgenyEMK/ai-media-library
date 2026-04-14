import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopStoreProvider } from "./stores/desktop-store";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <DesktopStoreProvider>
      <App />
    </DesktopStoreProvider>
  </StrictMode>,
);
