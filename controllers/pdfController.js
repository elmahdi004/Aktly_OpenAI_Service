import path from "path";
import { downloadPdf, convertPdfToImages, cleanOutputDirectory } from "../services/pdfService.js";
import { analyzeImage, analyzeText } from "../services/openaiService.js";
import { uploadImage } from "../services/imageService.js";
import scrapePage from "../services/scrapePage.js";

const __dirname = path.resolve();

export const processCompanyPdfs = async (req, res) => {
  const companyId = req.params.id;
  const pageUrl = `https://www.ejustice.just.fgov.be/cgi_tsv/list.pl?language=fr&btw=${companyId}`;
  const outputDir = path.join(__dirname, "output");

  try {
    // Get PDFs from the page
    console.log("Scraping page to retrieve PDF data...");
    const pdfArray = await scrapePage(pageUrl);
    
    if (!pdfArray?.length) {
      return res.status(404).json({ error: "No PDFs found on the provided page." });
    }

    // Clean output directory
    await cleanOutputDirectory(outputDir);

    // Process all PDFs
    const allExtractedTexts = await processPdfArray(pdfArray, outputDir);

    if (!allExtractedTexts.length) {
      return res.status(500).json({ error: "No text was extracted from the PDFs." });
    }

    // Generate final response
    const finalResponse = await generateFinalResponse(allExtractedTexts);

    res.json({
      message: "PDFs processed successfully",
      finalResponse,
      totalPdfsProcessed: pdfArray.length,
      totalTextsExtracted: allExtractedTexts.length
    });

  } catch (error) {
    console.error("Error in convert-pdf endpoint:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const processPdfArray = async (pdfArray, outputDir) => {
  const allExtractedTexts = [];

  for (const pdf of pdfArray) {
    try {
      const extractedTexts = await processSinglePdf(pdf, outputDir);
      allExtractedTexts.push(...extractedTexts);
    } catch (error) {
      console.error(`Error processing PDF ${pdf.pdfUrl}:`, error.message);
      // Continue with other PDFs even if one fails
    }
  }

  return allExtractedTexts;
};

const processSinglePdf = async (pdf, outputDir) => {
  const { pdfUrl, date } = pdf;
  console.log(`Processing PDF from: ${pdfUrl}`);

  // Download and convert PDF
  const pdfPath = await downloadPdf(pdfUrl, outputDir);
  const images = await convertPdfToImages(pdfPath, outputDir);

  if (!images.length) {
    console.warn(`No images generated for PDF from: ${pdfUrl}`);
    return [];
  }

  // Extract text from all images
  const extractedTexts = [];
  for (const image of images) {
    try {
      const text = await extractTextFromImage(image, outputDir);
      if (text) {
        extractedTexts.push({ date, text });
      }
    } catch (error) {
      console.error(`Error processing image ${image}:`, error.message);
    }
  }

  return extractedTexts;
};

const extractTextFromImage = async (imageName, outputDir) => {
  const localImagePath = path.join(outputDir, imageName);
  
  console.log(`Uploading image to Cloudinary: ${localImagePath}`);
  const imageUrl = await uploadImage(localImagePath);
  
  console.log(`Analyzing image with OpenAI: ${imageUrl}`);
  return await analyzeImage(imageUrl);
};

const generateFinalResponse = async (allExtractedTexts) => {
  console.log("Merging extracted texts based on the latest dates...");
  
  const mergedTexts = allExtractedTexts
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(item => item.text)
    .join("\n");

  console.log("Analyzing the combined text...");
  return await analyzeText(mergedTexts);
};