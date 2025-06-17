import express from "express";
import path from "path";
import fs from "fs/promises";
import pdfPoppler from "pdf-poppler";
import axios from "axios";
import { analyzeImage, analyzeText } from "./services/openaiService.js";
import { uploadImage } from "./services/imageService.js";
import scrapePage from "./services/scrapePage.js";
import cors from 'cors';

const app = express();
app.use(cors());
const __dirname = path.resolve();

// Function to download PDF from a URL
const downloadPdf = async (pdfUrl, outputDir) => {
  try {
    const response = await axios({
      method: "get",
      url: pdfUrl,
      responseType: "arraybuffer",
    });

    const pdfPath = path.join(outputDir, "downloaded.pdf");
    await fs.writeFile(pdfPath, response.data);
    return pdfPath;
  } catch (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

const convertPdfToImages = async (pdfPath, outputDir) => {
  try {
    console.log(`Starting PDF conversion for: ${pdfPath}`);

    const opts = {
      format: "jpeg", // Output format
      out_dir: outputDir, // Output directory
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)), // Prefix for output files
      page: null, // Process all pages
    };

    // Convert PDF to images
    await pdfPoppler.convert(pdfPath, opts);
    console.log(`PDF converted. Checking output directory: ${outputDir}`);

    // Wait a short period to ensure images are written to disk
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read and filter the output directory
    const files = await fs.readdir(outputDir);
    console.log(`Files in output directory: ${files}`);

    // Normalize extensions to handle case sensitivity
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase(); // Normalize extension case
      return ext === ".jpg" || ext === ".png";
    });

    if (imageFiles.length === 0) {
      console.error(
        "No image files detected. Check file extensions and output directory."
      );
      console.error(`All files in directory: ${files}`);
      throw new Error("No image files detected after PDF conversion.");
    }

    console.log(`Filtered image files: ${imageFiles}`);
    return imageFiles;
  } catch (error) {
    console.error(`Error in convertPdfToImages: ${error.message}`);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
};


app.get("/convert-pdf/:id", async (req, res) => {
  // const pageUrl = req.body?.pageUrl;
  // return 'hello';
  const pageUrl =
    `https://www.ejustice.just.fgov.be/cgi_tsv/list.pl?language=fr&btw=${req.params.id}`;
  const outputDir = path.join(__dirname, "output");

  try {
    // Scrape the page to get the array of PDFs
    console.log("Scraping page to retrieve PDF data...");
    const pdfArray = await scrapePage(pageUrl);
    console.log("Retrieved PDF data:", pdfArray);

    if (!pdfArray || pdfArray.length === 0) {
      throw new Error("No PDFs found on the provided page.");
    }

    // Clean the output directory before starting the operation
    console.log("Cleaning the output directory...");
    await fs.rm(outputDir, { recursive: true, force: true }); // Delete the folder and its contents
    await fs.mkdir(outputDir, { recursive: true }); // Recreate the empty folder

    const allExtractedTexts = [];

    // Process each PDF in the array
    for (const pdf of pdfArray) {
      const { pdfUrl, date } = pdf;
      console.log(`Processing PDF from: ${pdfUrl}`);

      // Download the PDF
      const pdfPath = await downloadPdf(pdfUrl, outputDir);
      console.log(`PDF downloaded to: ${pdfPath}`);

      // Convert PDF to images
      console.log("Converting PDF to images...");
      const images = await convertPdfToImages(pdfPath, outputDir);
      console.log(`Converted images: ${images}`);

      if (images.length === 0) {
        console.warn(
          `No images generated for PDF from: ${pdfUrl}. Skipping...`
        );
        continue;
      }

      // Extract text from images and append it to the extractedTexts array
      for (const image of images) {
        const localImagePath = path.join(outputDir, image);

        try {
          console.log(`Uploading image to Cloudinary: ${localImagePath}`);
          const imageUrl = await uploadImage(localImagePath);
          console.log(`Image uploaded to Cloudinary: ${imageUrl}`);

          console.log(`Analyzing image with OpenAI: ${imageUrl}`);
          const text = await analyzeImage(imageUrl);
          console.log(`Extracted text for ${date}: ${text}`);

          allExtractedTexts.push({ date, text });
        } catch (error) {
          console.error(
            `Error processing image ${localImagePath}:`,
            error.message
          );
        }
      }
    }

    if (allExtractedTexts.length === 0) {
      throw new Error(
        "No text was extracted from the PDFs. Check OpenAI integration."
      );
    }

    // Merge texts by selecting only the latest data based on dates
    console.log("Merging extracted texts based on the latest dates...");
    const mergedTexts = allExtractedTexts
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
      .map((item) => item.text)
      .join("\n");

    console.log("Analyzing the combined text...");
    const finalResponse = await analyzeText(mergedTexts);

    // Return the combined response
    res.json({
      message: "PDFs processed successfully",
      finalResponse,
      mergedTexts,
    });
  } catch (error) {
    console.error("Error in convert-pdf endpoint:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Serve converted images statically
app.use("/output", express.static(path.join(__dirname, "output")));
// ✅ Démarrer le serveur ici, après l'initialisation
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
(async () => {
  try {
    const pageUrl =
      "https://www.ejustice.just.fgov.be/cgi_tsv/list.pl?language=fr&btw=0782372801";

    console.log("hello world");
    const data = await scrapePage(pageUrl);
    console.log(data);
  } catch (error) {
    console.error("Erreur au démarrage :", error.message);
    process.exit(1);
  }
})();
