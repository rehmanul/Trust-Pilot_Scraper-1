import { IStorage } from "../storage";
import * as cheerio from "cheerio";
import { CorsProxyService } from "./cors-proxy";
import { DataExtractor } from "./data-extractor";

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
  private corsProxy: CorsProxyService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.corsProxy = new CorsProxyService();
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
    await this.storage.addLog({
      level: "info",
      message: `Starting real scraping for ${url}`,
      jobId,
    });

    const companies: any[] = [];
    const maxRetries = settings.retryAttempts || 3;
    let currentPage = 1;
    const maxPages = 10; // Limit pages to prevent infinite loops

    try {
      while (currentPage <= maxPages && !this.shouldStop) {
        let pageUrl = url;
        if (currentPage > 1) {
          pageUrl += `${url.includes('?') ? '&' : '?'}page=${currentPage}`;
        }

        await this.storage.addLog({
          level: "info",
          message: `Scraping page ${currentPage}: ${pageUrl}`,
          jobId,
        });

        let pageCompanies: any[] = [];
        let success = false;

        for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
          try {
            pageCompanies = await this.scrapePage(pageUrl, settings, jobId, attempt);
            success = true;
          } catch (error) {
            await this.storage.addLog({
              level: "warning",
              message: `Attempt ${attempt}/${maxRetries} failed for ${pageUrl}: ${error instanceof Error ? error.message : "Unknown error"}`,
              jobId,
            });

            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, (settings.delay || 2000) * attempt));
            }
          }
        }

        if (!success) {
          await this.storage.addLog({
            level: "error",
            message: `Failed to scrape ${pageUrl} after ${maxRetries} attempts`,
            jobId,
          });
          break;
        }

        if (pageCompanies.length === 0) {
          await this.storage.addLog({
            level: "info",
            message: `No more companies found on page ${currentPage}, stopping pagination`,
            jobId,
          });
          break;
        }

        // Filter by minimum rating if specified
        const filteredCompanies = pageCompanies.filter(company => 
          !settings.minRating || !company.rating || company.rating >= settings.minRating
        );

        companies.push(...filteredCompanies);

        await this.storage.addLog({
          level: "success",
          message: `Found ${pageCompanies.length} companies on page ${currentPage} (${filteredCompanies.length} after filtering)`,
          jobId,
        });

        // Save companies to storage
        for (const companyData of filteredCompanies) {
          await this.storage.addCompany({
            name: companyData.name || '',
            type: companyData.type || null,
            domain: companyData.domain || null,
            city: companyData.city || null,
            phone: companyData.phone || null,
            email: companyData.email || null,
            rating: companyData.rating || null,
            reviewCount: companyData.reviewCount || null,
            trustpilotUrl: companyData.trustpilotUrl || null,
            description: companyData.description || null,
            address: companyData.address || null,
            website: companyData.website || null,
            status: "complete",
            scrapingUrlId: null,
          });
        }

        currentPage++;

        // Apply delay between pages
        if (settings.delay && settings.delay > 0 && currentPage <= maxPages) {
          await new Promise(resolve => setTimeout(resolve, settings.delay));
        }
      }

      await this.storage.addLog({
        level: "success",
        message: `Completed scraping ${url}. Total companies found: ${companies.length}`,
        jobId,
      });

    } catch (error) {
      await this.storage.addLog({
        level: "error",
        message: `Critical error scraping ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId,
      });
    }

    return companies;
  }

  private async scrapePage(url: string, settings: ScrapingSettings, jobId: string, attempt: number): Promise<any[]> {
    const companies: any[] = [];

    await this.storage.addLog({
      level: "info", 
      message: `Fetching page content (attempt ${attempt})...`,
      jobId,
    });

    try {
      const htmlContent = await this.corsProxy.fetchWithCorsProxy(url, {
        timeout: 30000,
        maxRetries: 3
      });

      const $ = cheerio.load(htmlContent);

      await this.storage.addLog({
        level: "info",
        message: `Successfully loaded HTML content (${htmlContent.length} chars), parsing company data...`,
        jobId,
      });

      // Extract companies from category pages
      if (url.includes('/categories/')) {
        companies.push(...this.extractCompaniesFromCategory($, url, settings));
      }
      // Extract company details from individual business pages
      else if (url.includes('/review/')) {
        const company = this.extractCompanyFromBusinessPage($, url, settings);
        if (company) companies.push(company);
      }

      await this.storage.addLog({
        level: "success",
        message: `Extracted ${companies.length} companies from the page`,
        jobId,
      });

    } catch (error) {
      throw new Error(`Failed to fetch or parse ${url}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    return companies;
  }

  private extractCompaniesFromCategory($: cheerio.CheerioAPI, url: string, settings: ScrapingSettings): any[] {
    const companies: any[] = [];

    // Updated Trustpilot selectors based on current HTML structure
    const companySelectors = [
      '[data-testid="business-unit-card"]',
      '[data-business-unit-json]',
      '.business-unit-card',
      '.styles_businessUnitCard__iQiQi',
      '.styles_wrapper__2JOo2',
      '.review-card',
      '[data-testid="business-unit"]',
      '.business-unit',
    ];

    let foundCompanies = false;

    for (const selector of companySelectors) {
      const elements = $(selector);
      
      if (elements.length > 0) {
        foundCompanies = true;
        
        elements.each((index, element) => {
          if (index >= (settings.reviewLimit || 50)) return false;
          
          try {
            const $el = $(element);
            
            // Extract from JSON data attribute if available
            const jsonData = $el.attr('data-business-unit-json');
            if (jsonData) {
              try {
                const data = JSON.parse(jsonData);
                companies.push(this.parseCompanyFromJson(data, url));
                return;
              } catch {
                // Fall through to HTML parsing
              }
            }

            // Fallback to HTML parsing
            const company = this.parseCompanyFromHtml($el, url);
            if (company && company.name && company.name.trim().length > 2) {
              companies.push(company);
            }
          } catch (error) {
            // Skip individual parsing errors but continue processing
          }
        });
        break;
      }
    }

    // If no structured data found, try alternative approaches
    if (!foundCompanies) {
      // Try to find business links
      const linkElements = $('a[href*="/review/"]');
      linkElements.each((index, element) => {
        if (index >= (settings.reviewLimit || 50)) return false;
        
        const $link = $(element);
        const href = $link.attr('href');
        const name = $link.text().trim() || $link.find('h3, h2, .title').text().trim();
        
        if (href && name && name.length > 2) {
          companies.push({
            name: name,
            trustpilotUrl: href.startsWith('http') ? href : `https://www.trustpilot.com${href}`,
            domain: this.extractDomainFromUrl(href),
            type: this.getCategoryType(url),
          });
        }
      });

      // Try to find company names in headings
      if (companies.length === 0) {
        $('h1, h2, h3, h4').each((index, element) => {
          if (index >= (settings.reviewLimit || 50)) return false;
          
          const $heading = $(element);
          const text = $heading.text().trim();
          const link = $heading.find('a').attr('href') || $heading.closest('a').attr('href');
          
          if (text && text.length > 5 && text.length < 100) {
            companies.push({
              name: text,
              trustpilotUrl: link ? (link.startsWith('http') ? link : `https://www.trustpilot.com${link}`) : url,
              domain: link ? this.extractDomainFromUrl(link) : '',
              type: this.getCategoryType(url),
            });
          }
        });
      }
    }

    return companies.slice(0, (settings.reviewLimit || 50));
  }

  private extractCompanyFromBusinessPage($: cheerio.CheerioAPI, url: string, settings: ScrapingSettings): any | null {
    try {
      // Selectors for business page elements
      const name = $('[data-testid="business-unit-title"]').text().trim() ||
                   $('.business-info__title').text().trim() ||
                   $('h1').first().text().trim();

      const rating = parseFloat($('[data-testid="business-unit-rating"]').text()) ||
                     parseFloat($('.business-info__rating').text()) ||
                     parseFloat($('.rating').text());

      const reviewCount = parseInt($('[data-testid="business-unit-review-count"]').text().replace(/[^\d]/g, '')) ||
                         parseInt($('.business-info__review-count').text().replace(/[^\d]/g, '')) ||
                         parseInt($('.review-count').text().replace(/[^\d]/g, ''));

      const description = $('[data-testid="business-unit-description"]').text().trim() ||
                         $('.business-info__description').text().trim() ||
                         $('.description').text().trim();

      const website = $('[data-testid="business-unit-website"]').attr('href') ||
                     $('.business-info__website a').attr('href') ||
                     $('a[rel="noopener"]').attr('href');

      const domain = website ? this.extractDomainFromUrl(website) : this.extractDomainFromUrl(url);

      if (name) {
        return {
          name,
          rating: rating || null,
          reviewCount: reviewCount || null,
          description: description || null,
          website: website || null,
          domain,
          trustpilotUrl: url,
          type: this.getCategoryType(url),
        };
      }
    } catch (error) {
      // Return null if parsing fails
    }
    
    return null;
  }

  private parseCompanyFromJson(data: any, sourceUrl: string): any {
    const companyData = {
      name: data.displayName || data.name || '',
      rating: data.trustScore || data.rating || null,
      reviewCount: data.numberOfReviews || data.reviewCount || null,
      description: data.description || null,
      website: data.websiteUrl || data.website || null,
      domain: data.websiteUrl ? this.extractDomainFromUrl(data.websiteUrl) : null,
      trustpilotUrl: data.profileUrl || sourceUrl,
      type: this.getCategoryType(sourceUrl),
      city: data.location?.city || null,
      address: data.location?.address || null,
      email: data.contactInfo?.email || null,
      phone: data.contactInfo?.phone || null,
    };

    // Extract additional data from description and other fields
    const allText = JSON.stringify(data);
    if (!companyData.email) {
      const emails = DataExtractor.extractEmails(allText);
      companyData.email = emails.length > 0 ? emails[0] : null;
    }
    if (!companyData.phone) {
      const phones = DataExtractor.extractPhones(allText);
      companyData.phone = phones.length > 0 ? phones[0] : null;
    }

    return companyData;
  }

  private parseCompanyFromHtml($el: cheerio.Cheerio<cheerio.Element>, sourceUrl: string): any {
    // Try multiple selectors for company name
    const nameSelectors = [
      '[data-testid="business-unit-title"]',
      '.business-unit__title',
      '.styles_businessUnitTitle__i0K_F',
      '.styles_displayName__HCNvZ',
      'h1, h2, h3, h4',
      '.title',
      '[class*="title"]',
      '[class*="name"]'
    ];

    let name = '';
    for (const selector of nameSelectors) {
      name = $el.find(selector).first().text().trim();
      if (name && name.length > 2) break;
    }

    // Extract rating
    const ratingSelectors = [
      '[data-testid="business-unit-rating"]',
      '.rating',
      '.styles_rating__DGOyb',
      '[class*="rating"]',
      '[class*="trustScore"]'
    ];

    let rating: number | null = null;
    for (const selector of ratingSelectors) {
      const ratingText = $el.find(selector).text().trim();
      if (ratingText) {
        const parsed = parseFloat(ratingText.replace(/[^\d.]/g, ''));
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
          rating = parsed;
          break;
        }
      }
    }

    // Extract review count
    const reviewSelectors = [
      '[data-testid="business-unit-review-count"]',
      '.review-count',
      '.styles_reviewCount__DK2BT',
      '[class*="review"]',
      '[class*="count"]'
    ];

    let reviewCount: number | null = null;
    for (const selector of reviewSelectors) {
      const reviewText = $el.find(selector).text().trim();
      if (reviewText) {
        const parsed = parseInt(reviewText.replace(/[^\d]/g, ''));
        if (!isNaN(parsed) && parsed >= 0) {
          reviewCount = parsed;
          break;
        }
      }
    }

    // Extract Trustpilot URL
    const linkEl = $el.find('a[href*="/review/"]').first();
    let trustpilotUrl = sourceUrl;
    if (linkEl.length > 0) {
      const href = linkEl.attr('href');
      if (href) {
        trustpilotUrl = href.startsWith('http') ? href : `https://www.trustpilot.com${href}`;
      }
    }

    // Extract domain from Trustpilot URL or company website
    const domain = this.extractDomainFromUrl(trustpilotUrl);

    // Extract description
    const descriptionSelectors = [
      '[data-testid="business-unit-description"]',
      '.description',
      '.styles_description__xyz123',
      '[class*="description"]'
    ];

    let description = '';
    for (const selector of descriptionSelectors) {
      description = $el.find(selector).text().trim();
      if (description && description.length > 10) break;
    }

    // Extract all text content for additional data mining
    const allText = $el.text();
    const emails = DataExtractor.extractEmails(allText);
    const phones = DataExtractor.extractPhones(allText);
    const extractedCity = DataExtractor.extractCity(allText);
    const extractedAddress = DataExtractor.extractAddress(allText);

    return {
      name,
      rating,
      reviewCount,
      trustpilotUrl,
      domain,
      type: this.getCategoryType(sourceUrl),
      description: description || null,
      email: emails.length > 0 ? emails[0] : null,
      phone: phones.length > 0 ? phones[0] : null,
      city: extractedCity || null,
      address: extractedAddress || null,
    };
  }

  private extractDomainFromUrl(url: string): string {
    try {
      if (url.includes('/review/')) {
        const match = url.match(/\/review\/([^/?]+)/);
        return match ? match[1] : '';
      }
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private getCategoryType(url: string): string {
    const categoryMap: { [key: string]: string } = {
      'tools_equipment': 'Tools & Equipment',
      'construction_manufacturi': 'Construction & Manufacturing',
      'electronics_technology': 'Electronics & Technology',
      'health_medical': 'Health & Medical',
      'money_insurance': 'Finance & Insurance',
      'home_garden': 'Home & Garden',
      'travel_vacation': 'Travel & Vacation',
      'shopping_fashion': 'Shopping & Fashion',
      'food_beverages': 'Food & Beverages',
      'automotive': 'Automotive',
    };

    if (url.includes('/categories/')) {
      const category = url.split('/categories/')[1].split('?')[0].split('/')[0];
      return categoryMap[category] || 'General Business';
    }

    return 'General Business';
  }
}
