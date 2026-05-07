import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import ToastProvider from "./components/ToastProvider";
import HealthProvider from "./components/HealthProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <HealthProvider>
          <App />
        </HealthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
