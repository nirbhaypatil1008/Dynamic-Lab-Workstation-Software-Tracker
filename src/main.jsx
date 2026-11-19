import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "./context/AppContext.jsx";
import App from "./App.jsx";
import "./style.css";

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
