import { IStorage } from "../storage";

interface ScrapingSettings {
  reviewLimit?: number;
  delay?: number;
  concurrentRequests?: number;
  minRating?: number;
  corsProxy?: string;
  retryAttempts?: number;
  outputFormat?: string;
  includeImages?: boolean;
}

export class TrustpilotScraper {
  private storage: IStorage;
  private isRunning = false;
  private shouldStop = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async startScraping(jobId: string, urls: string[], settings: ScrapingSettings = {}) {
    if (this.isRunning) {
      throw new Error("Scraping is already in progress");
    }

    this.isRunning = true;
    this.shouldStop = false;

    try {
      await this.storage.updateScrapingJob(jobId, { 
        status: "running",
        startedAt: new Date()
      });

      await this.storage.addLog({
        level: "info",
        message: "Scraping process initiated",
        jobId,
      });

      let processedUrls = 0;
      let totalCompanies = 0;
      let errors = 0;

      for (const url of urls) {
        if (this.shouldStop) {
          await this.storage.addLog({
            level: "warning",
            message: "Scraping stopped by user request",
            jobId,
          });
          break;
        }

        try {
          await this.storage.addLog({
            level: "info",
            message: `Processing URL: ${url}`,
            jobId,
          });

          const companies = await this.scrapeUrl(url, settings, jobId);
          totalCompanies += companies.length;

          await this.storage.addLog({
            level: "success",
            message: `Found ${companies.length} companies from ${url}`,
            jobId,
          });

        } catch (error) {
          errors++;
          await this.storage.addLog({
            level: "error",
            message: `Failed to process URL ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
            jobId,
          });
        }

        processedUrls++;
        await this.storage.updateScrapingJob(jobId, {
          processedUrls,
          totalCompanies,
          errors,
        });

        // Apply delay between requests
        if (settings.delay && settings.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, settings.delay));
        }
      }

      const finalStatus = this.shouldStop ? "stopped" : "completed";
      await this.storage.updateScrapingJob(jobId, {
        status: finalStatus,
        completedAt: new Date(),
      });

      await this.storage.addLog({
        level: "success",
        message: `Scraping ${finalStatus}. Processed ${processedUrls}/${urls.length} URLs, found ${totalCompanies} companies with ${errors} errors.`,
        jobId,
      });

    } catch (error) {
      await this.storage.updateScrapingJob(jobId, {
        status: "error",
        completedAt: new Date(),
      });

      await this.storage.addLog({
        level: "error",
        message: `Scraping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId,
      });
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  async stopScraping() {
    this.shouldStop = true;
  }

  private async scrapeUrl(url: string, settings: ScrapingSettings, jobId: string): Promise<any[]> {
    // This is a simulated scraping function since real web scraping would require
    // complex CORS handling and might be blocked by Trustpilot's anti-bot measures.
    // In a real implementation, this would:
    // 1. Use CORS proxies or a backend proxy server
    // 2. Parse HTML content from Trustpilot pages
    // 3. Extract company information from the DOM
    // 4. Handle pagination and rate limiting
    // 5. Retry failed requests

    await this.storage.addLog({
      level: "info",
      message: `Simulating scraping for ${url} (real implementation would parse Trustpilot pages)`,
      jobId,
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate sample data that would come from actual scraping
    const sampleCompanies = this.generateSampleData(url);

    // Save companies to storage
    for (const companyData of sampleCompanies) {
      await this.storage.addCompany({
        ...companyData,
        status: "complete",
      });
    }

    return sampleCompanies;
  }

  private generateSampleData(url: string): any[] {
    // This generates realistic sample data based on the URL category
    // In a real implementation, this would be replaced with actual scraping logic
    
    const categoryMap: { [key: string]: any } = {
      tools_equipment: {
        type: "Tools & Equipment",
        companies: [
          {
            name: "Pro Tools Italia",
            domain: "protoolsitalia.com",
            city: "Milano",
            rating: 4.5,
            reviewCount: 342,
            phone: "+39 02 1234567",
            email: "info@protoolsitalia.com",
            description: "Professional tools and equipment supplier",
            website: "https://protoolsitalia.com",
          },
          {
            name: "Ferramenta Centrale",
            domain: "ferramentacentrale.it",
            city: "Roma",
            rating: 4.2,
            reviewCount: 156,
            phone: "+39 06 7654321",
            email: "vendite@ferramentacentrale.it",
            description: "Hardware store with professional tools",
            website: "https://ferramentacentrale.it",
          },
        ],
      },
      electronics_technology: {
        type: "Electronics & Technology",
        companies: [
          {
            name: "TechStore Milano",
            domain: "techstore.it",
            city: "Milano",
            rating: 4.7,
            reviewCount: 892,
            phone: "+39 02 9876543",
            email: "support@techstore.it",
            description: "Electronics and technology retailer",
            website: "https://techstore.it",
          },
        ],
      },
    };

    // Extract category from URL
    let category = "default";
    if (url.includes("/categories/")) {
      const urlCategory = url.split("/categories/")[1].split("?")[0];
      if (categoryMap[urlCategory]) {
        category = urlCategory;
      }
    }

    const categoryData = categoryMap[category] || categoryMap.tools_equipment;
    
    return categoryData.companies.map((company: any) => ({
      ...company,
      type: categoryData.type,
      trustpilotUrl: url,
      address: `Via Example 123, ${company.city}, Italy`,
    }));
  }
}
