import path from "path";
import fs from "fs/promises";
import pdfPoppler from "pdf-poppler";
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

    const opts = {
      format: "jpeg",
      out_dir: outputDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      page: null,
    };

    await pdfPoppler.convert(pdfPath, opts);
    
    // Wait for files to be written
    await new Promise(resolve => setTimeout(resolve, 500));

    return await getImageFiles(outputDir);
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

  const imageFiles = files.filter(file => {
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