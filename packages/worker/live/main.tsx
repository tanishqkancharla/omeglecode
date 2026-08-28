import { MauiProvider } from "maui";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <MauiProvider>
    <App />
  </MauiProvider>,
);
