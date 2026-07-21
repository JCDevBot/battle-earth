import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { installContextualMapGeneration } from "./app/installContextualMapGeneration.js";
import { MapEngine } from "./map/engine/MapEngine";
import "./index.css";

installContextualMapGeneration(MapEngine);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
