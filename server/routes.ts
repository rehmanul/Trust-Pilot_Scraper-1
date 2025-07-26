import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScrapingUrlSchema, insertScrapingJobSchema, insertLogSchema } from "@shared/schema";
import { TrustpilotScraper } from "./services/scraper";
import { ExportService } from "./services/export";

export async function registerRoutes(app: Express): Promise<Server> {
  const scraper = new TrustpilotScraper(storage);
  const exportService = new ExportService(storage);

  // Scraping URLs endpoints
  app.get("/api/scraping/urls", async (req, res) => {
    try {
      const urls = await storage.getScrapingUrls();
      res.json(urls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch URLs" });
    }
  });

  app.post("/api/scraping/urls", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || !url.includes("trustpilot.com")) {
        return res.status(400).json({ error: "Invalid Trustpilot URL" });
      }

      // Extract name from URL
      let name = "Custom URL";
      if (url.includes("/categories/")) {
        const category = url.split("/categories/")[1].split("?")[0];
        name = category.replace(/_/g, " & ").replace(/\b\w/g, (l: string) => l.toUpperCase());
      }

      const scrapingUrl = await storage.addScrapingUrl({ url, name });
      await storage.addLog({
        level: "info",
        message: `Added URL: ${name}`,
      });

      res.json(scrapingUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to add URL" });
    }
  });

  app.delete("/api/scraping/urls/:id", async (req, res) => {
    try {
      await storage.removeScrapingUrl(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove URL" });
    }
  });

  app.delete("/api/scraping/urls", async (req, res) => {
    try {
      await storage.clearScrapingUrls();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear URLs" });
    }
  });

  // Scraping control endpoints
  app.get("/api/scraping/current-job", async (req, res) => {
    try {
      const job = await storage.getCurrentJob();
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current job" });
    }
  });

  app.post("/api/scraping/start", async (req, res) => {
    try {
      const { urls, settings } = req.body;

      if (!urls || urls.length === 0) {
        return res.status(400).json({ error: "No URLs provided" });
      }

      const job = await storage.createScrapingJob({
        status: "pending",
        totalUrls: urls.length,
        processedUrls: 0,
        totalCompanies: 0,
        errors: 0,
        settings: settings || {},
        startedAt: new Date(),
      });

      await storage.addLog({
        level: "info",
        message: `Starting scraping job with ${urls.length} URLs`,
        jobId: job.id,
      });

      // Start scraping in background
      scraper.startScraping(job.id, urls, settings).catch(console.error);

      res.json({ jobId: job.id, message: "Scraping started successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start scraping" });
    }
  });

  app.post("/api/scraping/stop", async (req, res) => {
    try {
      await scraper.stopScraping();
      
      await storage.addLog({
        level: "warning",
        message: "Scraping stopped by user",
      });

      res.json({ message: "Scraping stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop scraping" });
    }
  });

  // Companies endpoints
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.delete("/api/companies", async (req, res) => {
    try {
      await storage.clearCompanies();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear companies" });
    }
  });

  // Logs endpoints
  app.get("/api/logs/:jobId?", async (req, res) => {
    try {
      const logs = await storage.getLogs(req.params.jobId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.delete("/api/logs", async (req, res) => {
    try {
      await storage.clearLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  // Export endpoint
  app.post("/api/export", async (req, res) => {
    try {
      const { format } = req.body;
      const companies = await storage.getCompanies();

      if (companies.length === 0) {
        return res.status(400).json({ error: "No data to export" });
      }

      const { data, filename, mimeType } = await exportService.exportData(companies, format);

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
