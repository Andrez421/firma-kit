import "@firma-kit/react/firma-kit.css";
import "@firma-kit/react/fonts.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

const raiz = document.getElementById("root");
if (raiz) createRoot(raiz).render(<StrictMode><App /></StrictMode>);
