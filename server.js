import express from "express";
import path from "path";
import fs from "fs/promises";
import cors from "cors";
import { processCompanyPdfs } from "./controllers/pdfController.js";
import puppeteer from "puppeteer";

const app = express();
const __dirname = path.resolve();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/convert-pdf/:id", processCompanyPdfs);

// Serve static files
app.use("/output", express.static(path.join(__dirname, "output")));

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const cacheDir =
      process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
    console.log(`Puppeteer cache directory (expected): ${cacheDir}`);
    try {
      const exe = puppeteer.executablePath();
      console.log(`Initial puppeteer executablePath(): ${exe}`);
    } catch (e) {
      console.log(
        `Unable to resolve puppeteer executablePath() at startup: ${e.message}`
      );
    }
  } catch (_) {}
});
