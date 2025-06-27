import path from "path";
import fs from "fs/promises";
import { pdf } from "pdf-to-img";
import axios from "axios";

export const downloadPdf = async (pdfUrl, outputDir) => {
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

export const convertPdfToImages = async (pdfPath, outputDir) => {
  try {
    console.log(`Starting PDF conversion for: ${pdfPath}`);
    const document = await pdf(pdfPath, { scale: 2 }); // scale is optional
    let counter = 1;
    const imageFiles = [];
    for await (const image of document) {
      const outPrefix = path.basename(pdfPath, path.extname(pdfPath));
      const imageFile = `${outPrefix}-${counter}.png`;
      const imagePath = path.join(outputDir, imageFile);
      await fs.writeFile(imagePath, image);
      imageFiles.push(imageFile);
      counter++;
    }
    if (!imageFiles.length) {
      throw new Error("No image files generated from PDF.");
    }
    console.log(`Found image files: ${imageFiles}`);
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

const getImageFiles = async (outputDir) => {
  const files = await fs.readdir(outputDir);
  console.log(`Files in output directory: ${files}`);
  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
  });
  if (!imageFiles.length) {
    console.error("No image files detected after PDF conversion.");
    console.error(`All files in directory: ${files}`);
    throw new Error("No image files detected after PDF conversion.");
  }
  console.log(`Found image files: ${imageFiles}`);
  return imageFiles;
};
