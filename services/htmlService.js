const puppeteer = require("puppeteer-core"); // ✅ Core version
const fs = require("fs-extra");
const path = require("path");

class HtmlService {
  constructor() {
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser) {
      console.log("Launching Puppeteer browser...");

      // Memory-optimized Chrome flags
      const launchOptions = {
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--single-process",
          "--no-remote-debugging-pipe",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-client-side-phishing-detection",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints",
          "--disable-hang-monitor",
          "--disable-ipc-flooding-protection",
          "--disable-popup-blocking",
          "--disable-prompt-on-repost",
          "--disable-renderer-backgrounding",
          "--disable-sync",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--no-pings",
          "--password-store=basic",
          "--use-mock-keychain",
          "--window-size=1920,1080",
        ],
        protocolTimeout: 180000,
      };

      // ✅ Find system Chrome/Chromium (no bundled)
      console.log("Finding system Chrome/Chromium...");

      const possiblePaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      ];

      let executablePath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          executablePath = p;
          console.log("Found system browser at:", p);
          break;
        }
      }

      if (!executablePath) {
        throw new Error(
          "No browser found. Please install Google Chrome or Chromium.",
        );
      }

      // ✅ Launch system Chrome
      this.browser = await puppeteer.launch({
        ...launchOptions,
        executablePath: executablePath,
      });

      this.browser.on("disconnected", () => {
        console.log("⚠️ Browser disconnected");
        this.browser = null;
      });

      console.log("✅ System browser launched:", executablePath);
      return this.browser;
    }

    return this.browser;
  }

  async htmlToPdf(htmlFilePath, outputPath, options = {}) {
    let page = null;
    let browser = null;

    try {
      console.log("HTML to PDF conversion started");
      console.log("Input:", htmlFilePath);
      console.log("Output:", outputPath);
      console.log("Options:", options);

      let htmlContent = await fs.readFile(htmlFilePath, "utf-8");

      if (
        !htmlContent.toLowerCase().includes("<!doctype html") &&
        !htmlContent.toLowerCase().includes("<html")
      ) {
        htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;
      }

      browser = await this.getBrowser();
      page = await browser.newPage();

      const pageSize = options.pageSize || "A4";
      const orientation = options.orientation || "portrait";

      const viewportSizes = {
        A4: { width: 794, height: 1123 },
        A3: { width: 1123, height: 1587 },
        Letter: { width: 816, height: 1056 },
        Legal: { width: 816, height: 1344 },
      };

      const viewport = viewportSizes[pageSize] || viewportSizes["A4"];

      await page.setViewport({
        width: orientation === "landscape" ? viewport.height : viewport.width,
        height: orientation === "landscape" ? viewport.width : viewport.height,
        deviceScaleFactor: 1,
      });

      console.log("Setting HTML content...");
      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Generating PDF...");
      const pdfOptions = {
        path: outputPath,
        format: pageSize,
        landscape: orientation === "landscape",
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: options.margin ? `${options.margin}mm` : "10mm",
          right: options.margin ? `${options.margin}mm` : "10mm",
          bottom: options.margin ? `${options.margin}mm` : "10mm",
          left: options.margin ? `${options.margin}mm` : "10mm",
        },
      };

      await page.pdf(pdfOptions);

      await page.close();
      page = null;

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log("✅ PDF created:", (stats.size / 1024).toFixed(2), "KB");
      } else {
        throw new Error("PDF file was not created");
      }

      console.log("Closing browser to free memory...");
      await this.closeBrowser();
      browser = null;

      return outputPath;
    } catch (error) {
      console.error("❌ HTML to PDF conversion failed:", error);

      if (page) {
        try {
          await page.close();
        } catch (closeError) {}
      }

      try {
        await this.closeBrowser();
      } catch (closeError) {}
      browser = null;

      throw error;
    }
  }

  async htmlStringToPdf(htmlContent, outputPath, options = {}) {
    let page = null;
    let browser = null;

    try {
      console.log("Converting HTML string to PDF...");

      browser = await this.getBrowser();
      page = await browser.newPage();

      const pageSize = options.pageSize || "A4";
      const orientation = options.orientation || "portrait";

      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await page.pdf({
        path: outputPath,
        format: pageSize,
        landscape: orientation === "landscape",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });

      await page.close();
      page = null;

      console.log("Closing browser to free memory...");
      await this.closeBrowser();
      browser = null;

      return outputPath;
    } catch (error) {
      console.error("HTML string to PDF failed:", error);

      if (page) {
        try {
          await page.close();
        } catch (closeError) {}
      }

      try {
        await this.closeBrowser();
      } catch (closeError) {}
      browser = null;

      throw error;
    }
  }

  async urlToPdf(url, outputPath, options = {}) {
    let page = null;
    let browser = null;

    try {
      console.log("Converting URL to PDF:", url);

      browser = await this.getBrowser();
      page = await browser.newPage();

      await page.goto(url, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      await page.pdf({
        path: outputPath,
        format: options.pageSize || "A4",
        landscape: options.orientation === "landscape",
        printBackground: true,
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });

      await page.close();
      page = null;

      console.log("Closing browser to free memory...");
      await this.closeBrowser();
      browser = null;

      return outputPath;
    } catch (error) {
      console.error("URL to PDF failed:", error);

      if (page) {
        try {
          await page.close();
        } catch (closeError) {}
      }

      try {
        await this.closeBrowser();
      } catch (closeError) {}
      browser = null;

      throw error;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log("✅ Browser closed");
      } catch (error) {
        console.error("Error closing browser:", error.message);
        this.browser = null;
      }
    }
  }
}

module.exports = new HtmlService();