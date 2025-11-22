/** Puppeteer configuration for Render deployment */
module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || '/tmp/puppeteer'
};
