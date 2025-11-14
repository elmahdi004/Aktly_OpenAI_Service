import express from "express";
import path from "path";
import fs from "fs/promises";
import cors from 'cors';
import { processCompanyPdfs } from "./controllers/pdfController.js";

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
});