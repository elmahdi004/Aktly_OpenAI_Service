/** Puppeteer configuration for Render deployment */
module.exports = {
  // Use Render's persistent cache location unless overridden.
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer'
};
