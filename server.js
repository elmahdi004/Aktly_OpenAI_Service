import express from "express";
import path from "path";
import fs from "fs/promises";
import pdfPoppler from "pdf-poppler";
import axios from "axios";
import { analyzeImage, analyzeText } from "./services/openaiService.js";
import { uploadImage } from "./services/imageService.js";
import scrapePage from "./services/scrapePage.js";
import cors from "cors";

const app = express();
app.use(cors());
const __dirname = path.resolve();

// 🚨 1. Démarre le serveur immédiatement
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// 🚨 2. Déplace les tests en dehors du flux principal
// ⚠️ Ne bloque surtout pas le démarrage du serveur avec du scraping

// Endpoint principal
app.get("/convert-pdf/:id", async (req, res) => {
  const pageUrl = `https://www.ejustice.just.fgov.be/cgi_tsv/list.pl?language=fr&btw=${req.params.id}`;
  const outputDir = path.join(__dirname, "output");

  try {
    const pdfArray = await scrapePage(pageUrl);
    if (!pdfArray || pdfArray.length === 0) {
      throw new Error("No PDFs found on the provided page.");
    }

    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    const allExtractedTexts = [];

    for (const pdf of pdfArray) {
      const { pdfUrl, date } = pdf;
      const pdfPath = await downloadPdf(pdfUrl, outputDir);
      const images = await convertPdfToImages(pdfPath, outputDir);

      for (const image of images) {
        const localImagePath = path.join(outputDir, image);
        const imageUrl = await uploadImage(localImagePath);
        const text = await analyzeImage(imageUrl);
        allExtractedTexts.push({ date, text });
      }
    }

    if (allExtractedTexts.length === 0) {
      throw new Error("No text was extracted from the PDFs.");
    }

    const mergedTexts = allExtractedTexts
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((item) => item.text)
      .join("\n");

    const finalResponse = await analyzeText(mergedTexts);

    res.json({
      message: "PDFs processed successfully",
      finalResponse,
      mergedTexts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve converted images statically
app.use("/output", express.static(path.join(__dirname, "output")));

// 🚫 (Optionnel) Retire le scraping de test bloquant
// Si tu veux tester le scraping, fais-le via un endpoint GET
