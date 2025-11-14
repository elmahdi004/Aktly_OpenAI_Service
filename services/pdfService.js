import path from "path";
import fs from "fs/promises";
import { pdf } from "pdf-to-img";
import axios from "axios";

export const downloadPdf = async (pdfUrl, outputDir, filename = "downloaded") => {
  try {
    const response = await axios({
      method: "get",
      url: pdfUrl,
      responseType: "arraybuffer",
      timeout: 30000,
    });
    const pdfPath = path.join(outputDir, `${filename}.pdf`);
    await fs.writeFile(pdfPath, response.data);
    console.log(`PDF downloaded: ${filename}.pdf`);
    return pdfPath;
  } catch (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

export const convertPdfToImages = async (pdfPath, outputDir, filename = "downloaded") => {
  try {
    console.log(`Starting PDF conversion for: ${pdfPath}`);
    const document = await pdf(pdfPath, { scale: 2 });
    let counter = 1;
    const imageFiles = [];
    
    for await (const image of document) {
      const imageFile = `${filename}-${counter}.png`;
      const imagePath = path.join(outputDir, imageFile);
      await fs.writeFile(imagePath, image);
      imageFiles.push(imageFile);
      counter++;
    }
    
    if (!imageFiles.length) {
      throw new Error("No image files generated from PDF.");
    }
    
    console.log(`Generated ${imageFiles.length} images for ${filename}`);
    return imageFiles;
  } catch (error) {
    console.error(`Error in convertPdfToImages: ${error.message}`);
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
};

export const cleanOutputDirectory = async (outputDir) => {
  console.log("Cleaning the output directory...");
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
};