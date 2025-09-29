// scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

/**
 * Scrape static HTML content using Axios + Cheerio
 */
async function scrapeStatic(url) {
  try {
    console.log(`Scraping static content from: ${url}`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    
    // Remove script, style, and other non-content elements
    $('script, style, nav, footer, header, iframe, noscript').remove();
    
    // Extract meaningful content
    const content = {
      title: $('title').text().trim() || '',
      headings: [],
      paragraphs: [],
      lists: []
    };

    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const text = $(el).text().trim();
      if (text) content.headings.push(text);
    });

    // Extract paragraphs
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) content.paragraphs.push(text);
    });

    // Extract list items
    $('li').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) content.lists.push(text);
    });

    return content;
  } catch (error) {
    console.error(`Error scraping static content: ${error.message}`);
    throw error;
  }
}

/**
 * Scrape dynamic JavaScript-rendered content using Puppeteer
 */
async function scrapeDynamic(url) {
  let browser;
  try {
    console.log(`Scraping dynamic content from: ${url}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);

    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, footer, header, iframe, noscript');
      unwanted.forEach(el => el.remove());

      const result = {
        title: document.title || '',
        headings: [],
        paragraphs: [],
        lists: []
      };

      // Extract headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const text = el.textContent.trim();
        if (text) result.headings.push(text);
      });

      // Extract paragraphs
      document.querySelectorAll('p').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 20) result.paragraphs.push(text);
      });

      // Extract list items
      document.querySelectorAll('li').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 10) result.lists.push(text);
      });

      return result;
    });

    return content;
  } catch (error) {
    console.error(`Error scraping dynamic content: ${error.message}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Clean and combine scraped content into a single text
 */
function cleanContent(content) {
  const allText = [
    content.title,
    ...content.headings,
    ...content.paragraphs,
    ...content.lists
  ].join('\n\n');

  // Clean up whitespace and special characters
  return allText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Split text into chunks of approximately chunkSize tokens
 * Rough approximation: 1 token ≈ 4 characters
 */
function chunkText(text, chunkSize = 400, overlap = 50) {
  const chunks = [];
  const avgCharsPerToken = 4;
  const chunkChars = chunkSize * avgCharsPerToken;
  const overlapChars = overlap * avgCharsPerToken;

  // Split by sentences first
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Create overlap by keeping last part of current chunk
      const words = currentChunk.split(' ');
      const overlapWords = Math.floor(words.length * (overlap / chunkSize));
      currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main scraping function
 */
async function scrapeWebsite(url, isDynamic = false) {
  try {
    const content = isDynamic 
      ? await scrapeDynamic(url)
      : await scrapeStatic(url);

    const cleanedText = cleanContent(content);
    const chunks = chunkText(cleanedText);

    console.log(`Scraped ${chunks.length} chunks from ${url}`);
    
    return {
      url,
      title: content.title,
      chunks,
      scrapedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    throw error;
  }
}

module.exports = {
  scrapeStatic,
  scrapeDynamic,
  scrapeWebsite,
  chunkText,
  cleanContent
};