import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import axios from "axios";
import * as pdfParse from "pdf-parse/lib/pdf-parse.js";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import os from "os";
import { fileURLToPath } from "url";

/**
 * Function to scrape the page and extract relevant metadata
 * @param {string} pageUrl - URL of the webpage to scrape
 * @returns {Array} - Filtered array of objects containing only Constitution and Augmentation de capital
 */

async function scrapePage(pageUrl) {
  try {
    // Fetch the webpage content
    const response = await fetch(pageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }
    const htmlContent = await response.text();

    // Parse the HTML using JSDOM
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Select all list items
    const items = document.querySelectorAll(".list-item");
    const extractedData = [];

    items.forEach((item) => {
      const titleElement = item.querySelector(".list-item--title");
      const pdfElement = item.querySelector("a.standard");
      const dateText =
        titleElement?.textContent.match(/\d{4}-\d{2}-\d{2}/)?.[0];

      // Extract title, date, and PDF URL
      const title = titleElement?.textContent.trim().replace(/\s+/g, " ");
      const pdfUrl = pdfElement
        ? new URL(pdfElement.getAttribute("href"), pageUrl).href
        : null;
      const date = dateText || null;

      if (title && pdfUrl && date) {
        extractedData.push({
          title,
          date,
          pdfUrl,
        });
      }
    });

    // Filter for items containing "Constitution" or "Augmentation de capital" in the title
    const filteredData = extractedData.filter((item) =>
      /Constitution|Augmentation de capital|CAPITAL|ACTIONS| DEMISSIONS et\/ou NOMINATIONS/i.test(
        item.title
      )
    );

    return filteredData;
  } catch (error) {
    console.error("Error scraping page:", error.message);
    return [];
  }
}

/**
 * Fetches a PDF from a URL and extracts its text content.
 * @param {string} pdfUrl - The URL of the PDF to fetch.
 * @returns {Promise<string>} - The extracted text content of the PDF.
 */

//démission et/ou nomination    => CAPITAL, ACTIONS
//  0782372801
//0828169271
//0456918993
// 0880456429

// Execute the scraping function and log the results
(async () => {
  // const data = await scrapePage(pageUrl);
  // console.log(
  //   "Filtered Data (Constitution & Augmentation de capital):",
  //   JSON.stringify(data, null, 2)
  // );

  // Extract text from the PDFs
  const pdfUrl =
    "https://www.ejustice.just.fgov.be/tsv_pdf/2024/02/13/24027030.pdf";
  console.log("hello world");
  const data = await scrapePage(pageUrl);
  console.log(data);
})();
