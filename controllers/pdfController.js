import path from "path";
import { downloadPdf, convertPdfToImages, cleanOutputDirectory } from "../services/pdfService.js";
import { analyzeImage, analyzeText } from "../services/openaiService.js";
import { uploadImage } from "../services/imageService.js";
import scrapePage from "../services/scrapePage.js";

const __dirname = path.resolve();

export const processCompanyPdfs = async (req, res) => {
  const rawCompanyId = req.params.id;
  const companyId = rawCompanyId.replace(/[^\d]/g, ''); // Keep only digits
  
  console.log("Raw company ID:", rawCompanyId);
  console.log("Cleaned company ID:", companyId);
  
  const pageUrl = `https://www.ejustice.just.fgov.be/cgi_tsv/list.pl?language=fr&btw=${companyId}`;
  console.log("Page URL:", pageUrl);
  
  const outputDir = path.join(__dirname, "output");

  try {
    console.log("Scraping page to retrieve PDF data...");
    const pdfArray = await scrapePage(pageUrl);
    
    if (!pdfArray?.length) {
      return res.status(404).json({ error: "No PDFs found on the provided page." });
    }

    await cleanOutputDirectory(outputDir);

    // ✅ Process all PDFs in parallel instead of sequentially
    const allExtractedTexts = await processPdfArrayParallel(pdfArray, outputDir);

    if (!allExtractedTexts.length) {
      return res.status(500).json({ error: "No text was extracted from the PDFs." });
    }

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

// ✅ NEW: Process PDFs in parallel
const processPdfArrayParallel = async (pdfArray, outputDir) => {
  console.log(`Processing ${pdfArray.length} unique PDFs in parallel...`);
  
  // Process all PDFs at once using Promise.all
  const results = await Promise.allSettled(
    pdfArray.map((pdf, index) => processSinglePdf(pdf, outputDir, index))
  );
  
  // Flatten all successful results
  const allExtractedTexts = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allExtractedTexts.push(...result.value);
    } else if (result.status === 'rejected') {
      console.error(`PDF ${index + 1} failed:`, result.reason);
    }
  });
  
  return allExtractedTexts;
};

const processSinglePdf = async (pdf, outputDir, index) => {
  const { pdfUrl, date } = pdf;
  console.log(`[PDF ${index + 1}] Processing: ${pdfUrl}`);

  try {
    // Download and convert PDF
    const pdfPath = await downloadPdf(pdfUrl, outputDir, `pdf-${index}`);
    const images = await convertPdfToImages(pdfPath, outputDir, `pdf-${index}`);

    if (!images.length) {
      console.warn(`[PDF ${index + 1}] No images generated`);
      return [];
    }

    // ✅ Process all images in parallel using Promise.all
    const extractedTextsPromises = images.map(image => 
      extractTextFromImage(image, outputDir, index)
    );
    
    const extractedTexts = await Promise.all(extractedTextsPromises);
    
    // Filter out null values and add dates
    const validTexts = extractedTexts
      .filter(text => text !== null)
      .map(text => ({ date, text }));
    
    console.log(`[PDF ${index + 1}] Extracted ${validTexts.length} text blocks`);
    return validTexts;

  } catch (error) {
    console.error(`[PDF ${index + 1}] Error:`, error.message);
    throw error;
  }
};

const extractTextFromImage = async (imageName, outputDir, pdfIndex) => {
  try {
    const localImagePath = path.join(outputDir, imageName);
    
    console.log(`  [PDF ${pdfIndex + 1}] Uploading image: ${imageName}`);
    const imageUrl = await uploadImage(localImagePath);
    
    console.log(`  [PDF ${pdfIndex + 1}] Analyzing image with OpenAI`);
    const text = await analyzeImage(imageUrl);
    
    return text;
  } catch (error) {
    console.error(`  [PDF ${pdfIndex + 1}] Error processing ${imageName}:`, error.message);
    return null;
  }
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
}
