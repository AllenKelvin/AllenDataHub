import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(registrations.map((registration) => registration.unregister()));
    }).catch(() => undefined);

    if (import.meta.env.PROD) {
      const swUrl = `/sw.js?v=${Date.now()}`;
      void navigator.serviceWorker.register(swUrl);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
