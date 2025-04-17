// Import Puppeteer
import puppeteer from "puppeteer";

// Function to handle the form submission and data scraping
async function scrapeData() {
  // Launch a new browser instance
  const browser = await puppeteer.launch();

  // Open a new page
  const page = await browser.newPage();

  // Navigate to the form page
  await page.goto("https://search.itaa.be/Search", {
    waitUntil: "networkidle2",
  });

  // Wait for the postal code input to be visible
  await page.waitForSelector("#ByPostalCode", { visible: true });
  await page.type("#ByPostalCode", "1000"); // Make sure this is the correct ID

  // Wait for the language input to be visible
  await page.waitForSelector("#ByLanguage", { visible: true });
  await page.type("#ByLanguage", "FR"); // Make sure this is the correct ID

  // Wait for the submit button to be visible and clickable
  await page.waitForSelector("#submitSearch.btn", { visible: true });
  await page.click("#submitSearch"); // Make sure this is the correct ID

  // Evaluate and extract data from the resulting page
  const results = await page.evaluate(() => {
    // Example: Extracting data from a table or list
    const items = Array.from(document.querySelectorAll(".result-item")); // Replace '.result-item' with actual selector
    return items;
  });

  // Output the results
  console.log(results);

  // Close the browser
  await browser.close();
}

// Call the scrapeData function
scrapeData().catch((error) => {
  console.error("Error scraping data:", error);
});
