// Import necessary modules using ES module syntax
import cloudinary from "cloudinary";
import dotenv from "dotenv";
// Assuming you have process.env.CLOUD_NAME, process.env.API_KEY, and process.env.API_SECRET set
import fs from "fs/promises";

dotenv.config();

cloudinary.v2.config({
  cloud_name: "ddtk9h9bc",
  api_key: "311952192168776",
  api_secret: "qgVCQPuBQuYk0DvrvmKdrlAQiGc",
});

const opts = {
  overwrite: true,
  invalidate: true,
  resource_type: "image",
  format: "png",
  quality: "auto:best",
};

const uploadImage = async (imagePath) => {
  try {
    // Read the local image and convert it to Base64
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString(
      "base64"
    )}`;

    // Upload the Base64 image to Cloudinary
    const result = await cloudinary.v2.uploader.upload(imageBase64, opts);
    if (result && result.secure_url) {
      console.log(result.secure_url);
      return result.secure_url;
    }
  } catch (error) {
    console.log(error.message);
    throw { message: error.message };
  }
};

export { uploadImage };
