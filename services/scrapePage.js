import puppeteer from 'puppeteer';
import * as fs from 'fs';

function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [];
  const platform = process.platform;
  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch (_) {}
  }
  return undefined; // Let Puppeteer use its downloaded Chromium
}

async function scrapePage(pageUrl) {
  let browser;
  try {
    console.log("Launching browser...");
    const executablePath = resolveExecutablePath();
    if (executablePath) {
      console.log(`Using browser executable: ${executablePath}`);
    } else {
      console.log('No system Chrome/Edge found. Falling back to bundled Chromium.');
    }
    browser = await puppeteer.launch({
      headless: 'new',
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });
    
    const page = await browser.newPage();
    
    // Disable cache to ensure fresh requests
    await page.setCacheEnabled(false);
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log("Navigating to page:", pageUrl);
    await page.goto(pageUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log("Waiting for list content...");
    await page.waitForSelector('.list', { timeout: 10000 });
    
    console.log("List found, extracting data...");
    
    // Get basic info for filtering
    const articles = await page.evaluate(() => {
      const items = document.querySelectorAll('.list-item');
      const results = [];
      
      items.forEach((item, index) => {
        const content = item.querySelector('.list-item--content');
        if (!content) return;
        
        const titleLink = content.querySelector('a[href*="article"]');
        const title = titleLink?.textContent?.trim().replace(/\s+/g, ' ');
        const articleUrl = titleLink?.href;
        
        const textContent = content.textContent;
        const dateMatch = textContent.match(/(\d{4})-(\d{2})-(\d{2})/);
        const date = dateMatch ? dateMatch[0] : null;
        
        if (title && date && articleUrl) {
          results.push({
            title,
            date,
            articleUrl,
            index
          });
        }
      });
      
      return results;
    });
    
    console.log(`Found ${articles.length} articles`);
    
    // Filter for relevant documents
    const filteredArticles = articles.filter((item) =>
      /Constitution|Augmentation de capital|CAPITAL|ACTIONS|DEMISSIONS|NOMINATIONS/i.test(item.title)
    );
    
    console.log(`Filtered to ${filteredArticles.length} relevant articles`);
    
    // Track unique PDFs to avoid duplicates
    const uniquePdfUrls = new Set();
    const pdfData = [];
    
    for (const article of filteredArticles) {
      try {
        console.log(`\nProcessing article ${article.index + 1}: ${article.title.substring(0, 60)}...`);
        console.log(`  Article URL: ${article.articleUrl}`);
        
        // Create a new page for each article to avoid state pollution
        const articlePage = await browser.newPage();
        await articlePage.setCacheEnabled(false);
        await articlePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        let pdfUrl = null;
        
        // Set up PDF detection
        articlePage.on('response', async (response) => {
          const url = response.url();
          const contentType = response.headers()['content-type'] || '';
          
          if (url.includes('.pdf') || contentType.includes('pdf')) {
            pdfUrl = url;
            console.log(`  Detected PDF in response: ${url}`);
          }
        });
        
        // Navigate to the article page
        await articlePage.goto(article.articleUrl, { 
          waitUntil: 'networkidle0',
          timeout: 20000 
        });
        
        // Wait a bit for any async PDF loading
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // If PDF not detected in responses, look in the page content
        if (!pdfUrl) {
          pdfUrl = await articlePage.evaluate(() => {
            // Look for iframe with PDF
            const iframe = document.querySelector('iframe[src*=".pdf"]');
            if (iframe) return iframe.src;
            
            // Look for direct PDF link
            const pdfLink = document.querySelector('a[href*=".pdf"]');
            if (pdfLink) return pdfLink.href;
            
            // Check if current URL is a PDF
            if (window.location.href.includes('.pdf')) {
              return window.location.href;
            }
            
            return null;
          });
        }
        
        await articlePage.close();
        
        // Check if this PDF URL is unique
        if (pdfUrl && !uniquePdfUrls.has(pdfUrl)) {
          console.log(`  ✓ Got unique PDF: ${pdfUrl}`);
          uniquePdfUrls.add(pdfUrl);
          pdfData.push({
            title: article.title,
            date: article.date,
            pdfUrl
          });
        } else if (pdfUrl) {
          console.log(`  ⊘ Skipping duplicate PDF: ${pdfUrl}`);
        } else {
          console.log(`  ✗ No PDF found for this article`);
        }
        
      } catch (error) {
        console.error(`Error processing article ${article.index}:`, error.message);
      }
    }
    
    console.log(`\nSuccessfully extracted ${pdfData.length} unique PDF URLs (skipped ${filteredArticles.length - pdfData.length} duplicates)\n`);
    
    await browser.close();
    return pdfData;
    
  } catch (error) {
    console.error("Error scraping page:", error.message);
    if (browser) {
      await browser.close();
    }
    return [];
  }
}

export default scrapePage;