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
    const maxPages = 100; // Increased to capture all pages (1851 companies typically need ~40+ pages)
    const companiesPerPage = 50; // Trustpilot typically shows 50 companies per page

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
            message: `No more companies found on page ${currentPage}, stopping pagination. Total companies collected: ${companies.length}`,
            jobId,
          });
          break;
        }

        // Check if we've reached the total expected count (for this URL it should be around 1851)
        if (companies.length >= 1850 && currentPage > 30) {
          await this.storage.addLog({
            level: "info",
            message: `Reached expected company count (${companies.length}), stopping pagination`,
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

      // Debug: Log a sample of the HTML to understand the structure
      const htmlSample = htmlContent.substring(0, 2000).replace(/\s+/g, ' ');
      await this.storage.addLog({
        level: "info",
        message: `HTML sample: ${htmlSample}`,
        jobId,
      });

      // Extract companies from category pages
      if (url.includes('/categories/')) {
        const extractedCompanies = await this.extractCompaniesFromCategory($, url, settings, jobId);
        companies.push(...extractedCompanies);
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

  private async extractCompaniesFromCategory($: cheerio.CheerioAPI, url: string, settings: ScrapingSettings, jobId: string): Promise<any[]> {
    const companies: any[] = [];

    // Enhanced selectors based on current Trustpilot DOM structure
    const businessCards = $(
      'div[class*="styles_businessUnitCard"], ' +
      'div[data-business-unit-json], ' +
      'article[data-testid*="business"], ' +
      'div[class*="businessCard"], ' +
      'div[class*="business-unit"], ' +
      'div[class*="company-card"], ' +
      'article[class*="review-card"], ' +
      '[data-testid="business-unit"], ' +
      '.business-listing-item, ' +
      '.company-item'
    );

    await this.storage.addLog({
      level: "info",
      message: `Found ${businessCards.length} business cards using current DOM structure`,
      jobId,
    });

    if (businessCards.length > 0) {
      businessCards.each((index, element) => {
        if (index >= (settings.reviewLimit || 100)) return false;

        const $card = $(element);

        // Extract business name - look for the company title
        let name = '';

        // Try multiple selectors for business name based on DOM inspection
        const nameSelectors = [
          'p[class*="styles_businessUnitTitle"]',
          'div[class*="business-unit-title"]', 
          'h3',
          'h2',
          'a[href*="/review/"] p:first-child',
          'p:first-child',
          '[data-testid*="title"]'
        ];

        for (const selector of nameSelectors) {
          const nameEl = $card.find(selector).first();
          if (nameEl.length > 0) {
            let rawName = nameEl.text().trim();

            // Extract just the company name, removing rating, reviews, and location data
            // Pattern: CompanyName + domain + rating + reviews + location
            const nameMatch = rawName.match(/^([^0-9.,]+?)(?:[a-z0-9.-]+\.[a-z]{2,}|[\d.,]+|Via |Strada |,)/i);
            if (nameMatch) {
              name = nameMatch[1].trim();
            } else {
              name = rawName.split(/[\d.,]/)[0].trim(); // Take everything before first number
            }

            // Clean up common prefixes and formatting issues
            name = name.replace(/^Più rilevante\s*/i, '');
            name = name.replace(/^RILEVANTE\s*/i, '');
            name = name.replace(/\s+/g, ' ');

            if (name && name.length > 2) break;
          }
        }

        // If still no name, try getting it from the link
        if (!name || name.length < 3) {
          const link = $card.find('a[href*="/review/"]').first();
          if (link.length > 0) {
            name = link.text().trim();
            if (!name || name.length < 3) {
              const href = link.attr('href');
              if (href) {
                const urlParts = href.split('/review/')[1]?.split('/')[0];
                name = urlParts ? urlParts.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
              }
            }

            // Clean up extracted name from link text too
            name = name.replace(/^Più rilevante\s*/i, '');
            name = name.replace(/^RILEVANTE\s*/i, '');
            name = name.replace(/\s+/g, ' ');
          }
        }

        // Skip if no valid name found
        if (!name || name.length < 3) return;

        // Extract rating from the concatenated text or rating elements
        let rating: number | null = null;

        // First try to find rating in structured elements
        const ratingSelectors = [
          'section[class*="styles_reviewStars"]',
          'div[class*="rating"]',
          'span[class*="star"]',
          '[data-rating]',
          'img[alt*="star"]'
        ];

        for (const selector of ratingSelectors) {
          const ratingEl = $card.find(selector).first();
          if (ratingEl.length > 0) {
            const dataRating = ratingEl.attr('data-rating');
            if (dataRating) {
              const parsed = parseFloat(dataRating);
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
                rating = parsed;
                break;
              }
            }

            const ratingText = ratingEl.text().trim();
            const ratingMatch = ratingText.match(/(\d+(?:[.,]\d+)?)/);
            if (ratingMatch) {
              const parsed = parseFloat(ratingMatch[1].replace(',', '.'));
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
                rating = parsed;
                break;
              }
            }
          }
        }

        // If no structured rating found, extract from concatenated text
        if (!rating) {
          const fullText = $card.text();
          const ratingMatch = fullText.match(/(\d+[.,]\d+)(?=\s*\d+\s*recensioni)/i);
          if (ratingMatch) {
            const parsed = parseFloat(ratingMatch[1].replace(',', '.'));
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
              rating = parsed;
            }
          }
        }

        // Extract review count from concatenated text or structured elements
        let reviewCount: number | null = null;

        // First try structured elements
        const reviewSelectors = [
          'p[class*="styles_reviewCount"]',
          'span:contains("recensioni")',
          'span:contains("reviews")',
          'a[href*="reviews"]',
          'p:contains("recensioni")',
          'div:contains("recensioni")'
        ];

        for (const selector of reviewSelectors) {
          const reviewEl = $card.find(selector).first();
          if (reviewEl.length > 0) {
            const reviewText = reviewEl.text().trim();
            const reviewMatch = reviewText.match(/([\d.,]+)\s*(?:recensioni|reviews)/i);
            if (reviewMatch) {
              const cleanNumber = reviewMatch[1].replace(/[.,]/g, '');
              const parsed = parseInt(cleanNumber);
              if (!isNaN(parsed) && parsed > 0 && parsed < 10000000) {
                reviewCount = parsed;
                break;
              }
            }
          }
        }

        // If no structured review count found, extract from concatenated text
        if (!reviewCount) {
          const fullText = $card.text();
          const reviewMatch = fullText.match(/([\d.,]+)\s*recensioni/i);
          if (reviewMatch) {
            const cleanNumber = reviewMatch[1].replace(/[.,]/g, '');
            const parsed = parseInt(cleanNumber);
            if (!isNaN(parsed) && parsed > 0 && parsed < 10000000) {
              reviewCount = parsed;
            }
          }
        }

        // Extract location/address from concatenated text or structured elements
        let city: string | null = null;
        let address: string | null = null;

        // First try structured elements
        const locationSelectors = [
          'p[class*="styles_location"]',
          'div[class*="address"]',
          'span[class*="city"]',
          'p:contains("Via ")',
          'p:contains("Strada ")'
        ];

        for (const selector of locationSelectors) {
          const locationEl = $card.find(selector).first();
          if (locationEl.length > 0) {
            const locationText = locationEl.text().trim();
            if (locationText && locationText.length > 3) {
              address = locationText;
              const cityMatch = locationText.match(/,\s*([^,]+)(?:,|$)/);
              if (cityMatch) {
                city = cityMatch[1].trim();
              } else {
                const parts = locationText.split(/\s+/);
                if (parts.length > 1) {
                  city = parts[parts.length - 1];
                }
              }
              break;
            }
          }
        }

        // If no structured location found, extract from concatenated text
        if (!address) {
          const fullText = $card.text();
          // Look for Italian address patterns (Via/Strada followed by address)
          const addressMatch = fullText.match(/(Via|Strada|Viale|Piazza)\s+[^,]+,\s*[^,]+,\s*[^,]+/i);
          if (addressMatch) {
            address = addressMatch[0].trim();
            // Extract city (typically the second-to-last part before "Italia")
            const addressParts = address.split(',').map(p => p.trim());
            if (addressParts.length >= 2) {
              city = addressParts[addressParts.length - 2];
              if (city.toLowerCase().includes('italia')) {
                city = addressParts[addressParts.length - 3] || null;
              }
            }
          }
        }

        // Get Trustpilot URL and extract domain
        let trustpilotUrl = url;
        let domain = '';

        const linkEl = $card.find('a[href*="/review/"]').first();
        if (linkEl.length > 0) {
          const href = linkEl.attr('href');
          if (href) {
            trustpilotUrl = href.startsWith('http') ? href : `https://www.trustpilot.com${href}`;
          }
        }

        // Extract domain from concatenated text (usually appears after company name)
        const fullText = $card.text();
        const domainMatch = fullText.match(/([a-z0-9.-]+\.[a-z]{2,})/i);
        if (domainMatch) {
          domain = domainMatch[1].toLowerCase();
        } else {
          domain = this.extractDomainFromUrl(trustpilotUrl);
        }

        // Final name cleanup and validation
        name = name.trim();
        if (name && name.length >= 3 && !name.toLowerCase().includes('unknown')) {
          companies.push({
            name: name,
            rating: rating,
            reviewCount: reviewCount,
            trustpilotUrl: trustpilotUrl,
            domain: domain,
            type: this.getCategoryType(url),
            description: null,
            email: null,
            phone: null,
            city: city,
            address: address,
            website: domain ? `https://${domain}` : null,
          });
        }
      });
    }

    // Fallback: if no structured cards found, look for any business links
    if (companies.length === 0) {
      await this.storage.addLog({
        level: "warning",
        message: `No business cards found, trying to extract from business links`,
        jobId,
      });

      const businessLinks = $('a[href*="/review/"]');
      businessLinks.each((index, element) => {
        if (index >= (settings.reviewLimit || 100)) return false;

        const $link = $(element);
        const href = $link.attr('href');

        if (!href) return;

        let name = $link.text().trim();
        if (!name || name.length < 3) {
          const urlParts = href.split('/review/')[1]?.split('/')[0];
          name = urlParts ? urlParts.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
        }

        // Clean up name before adding
        name = name.replace(/^Più rilevante\s*/i, '').replace(/^RILEVANTE\s*/i, '').trim();

        if (name && name.length >= 3 && !name.toLowerCase().includes('unknown')) {
          const trustpilotUrl = href.startsWith('http') ? href : `https://www.trustpilot.com${href}`;

          companies.push({
            name: name,
            rating: null,
            reviewCount: null,
            trustpilotUrl: trustpilotUrl,
            domain: this.extractDomainFromUrl(trustpilotUrl),
            type: this.getCategoryType(url),
            description: null,
            email: null,
            phone: null,
            city: null,
            address: null,
            website: null,
          });
        }
      });
    }

    await this.storage.addLog({
      level: "info",
      message: `Extracted ${companies.length} companies using current DOM structure`,
      jobId,
    });

    // Remove duplicates based on name and return results
    const uniqueCompanies = companies.filter((company, index, self) => 
      index === self.findIndex(c => c.name.toLowerCase() === company.name.toLowerCase())
    );

    return uniqueCompanies.slice(0, (settings.reviewLimit || 100));
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
    // Enhanced selectors for company name based on current Trustpilot structure
    const nameSelectors = [
      '[data-testid="business-unit-title"]',
      '[data-testid*="title"]',
      '.business-unit__title',
      '.styles_businessUnitTitle__*',
      '.styles_displayName__*',
      '[class*="displayName"]',
      '[class*="businessUnitTitle"]',
      '[class*="companyName"]',
      'h1, h2, h3, h4, h5',
      '.title',
      '[class*="title"]',
      '[class*="name"]',
      'a[href*="/review/"]',
      '.company-name'
    ];

    let name = '';
    for (const selector of nameSelectors) {
      name = $el.find(selector).first().text().trim();
      if (name && name.length > 2) break;
    }

    // Enhanced rating extraction
    const ratingSelectors = [
      '[data-testid="business-unit-rating"]',
      '[data-testid*="rating"]',
      '.rating',
      '.styles_rating__*',
      '.trustscore',
      '[class*="rating"]',
      '[class*="trustScore"]',
      '[class*="score"]',
      '.star-rating',
      '[aria-label*="rating"]',
      '[title*="rating"]'
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

    // Enhanced review count extraction  
    const reviewSelectors = [
      '[data-testid="business-unit-review-count"]',
      '[data-testid*="review"]',
      '[data-testid*="count"]',
      '.review-count',
      '.styles_reviewCount__*',
      '.numberOfReviews',
      '[class*="reviewCount"]',
      '[class*="numberOfReviews"]',
      '[class*="review"]',
      '[class*="count"]',
      'span:contains("reviews")',
      'span:contains("recensioni")',
      'a[href*="reviews"]'
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

    // Enhanced description and additional data extraction
    const descriptionSelectors = [
      '[data-testid="business-unit-description"]',
      '[data-testid*="description"]',
      '.description',
      '.styles_description__*',
      '.business-description',
      '[class*="description"]',
      '[class*="about"]',
      '.summary',
      '.bio'
    ];

    // Extract category/business type
    const categorySelectors = [
      '[data-testid*="category"]',
      '.category',
      '.business-category',
      '[class*="category"]',
      '[class*="industry"]',
      '.tags',
      '.business-type'
    ];

    // Extract location/address information  
    const locationSelectors = [
      '[data-testid*="location"]',
      '[data-testid*="address"]',
      '.location',
      '.address',
      '.business-location',
      '[class*="location"]',
      '[class*="address"]',
      '[class*="city"]',
      '.contact-info'
    ];

    let description = '';
    for (const selector of descriptionSelectors) {
      description = $el.find(selector).text().trim();
      if (description && description.length > 10) break;
    }

    // Extract category/business type
    let category = this.getCategoryType(sourceUrl);
    for (const selector of categorySelectors) {
      const categoryText = $el.find(selector).text().trim();
      if (categoryText && categoryText.length > 3 && categoryText.length < 100) {
        category = categoryText;
        break;
      }
    }

    // Extract location information
    let locationInfo = '';
    for (const selector of locationSelectors) {
      locationInfo = $el.find(selector).text().trim();
      if (locationInfo && locationInfo.length > 3) break;
    }

    // Extract all text content for comprehensive data mining
    const allText = $el.text();
    const emails = DataExtractor.extractEmails(allText);
    const phones = DataExtractor.extractPhones(allText);
    const extractedCity = DataExtractor.extractCity(allText + ' ' + locationInfo);
    const extractedAddress = DataExtractor.extractAddress(allText + ' ' + locationInfo);

    // Extract website/domain from links
    let website = '';
    const websiteLink = $el.find('a[href^="http"]:not([href*="trustpilot"])').first();
    if (websiteLink.length > 0) {
      website = websiteLink.attr('href') || '';
    }

    // Don't create entries for companies without valid names
    if (!name || name.length < 3 || name === 'Unknown Company') {
      return null;
    }

    return {
      name: name,
      rating: rating,
      reviewCount: reviewCount,
      trustpilotUrl: trustpilotUrl,
      domain: website ? DataExtractor.extractDomain(website) : this.extractDomainFromUrl(trustpilotUrl),
      type: category,
      description: description || null,
      email: emails.length > 0 ? emails[0] : null,
      phone: phones.length > 0 ? phones[0] : null,
      city: extractedCity || (locationInfo ? locationInfo.split(',')[0].trim() : null),
      address: extractedAddress || locationInfo || null,
      website: website || null,
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

  // Get detailed company information by fetching individual business page
  private async getCompanyDetails(basicCompany: any, settings: ScrapingSettings, jobId: string): Promise<any> {
    if (!basicCompany.trustpilotUrl || basicCompany.trustpilotUrl.includes('/categories/')) {
      return basicCompany;
    }

    try {
      // Add small delay to respect rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      const htmlContent = await this.corsProxy.fetchWithCorsProxy(basicCompany.trustpilotUrl, {
        timeout: 15000,
        maxRetries: 2
      });

      const $ = cheerio.load(htmlContent);

      // Enhanced data extraction from business page
      const detailSelectors = {
        website: [
          '[data-testid="business-website-link"]',
          '.business-info__website a',
          'a[rel="noopener"]',
          'a[href^="http"]:not([href*="trustpilot"])',
          '.website-link'
        ],
        phone: [
          '[data-testid="business-phone"]',
          '.business-info__phone',
          '.phone',
          '[href^="tel:"]',
          '.contact-phone'
        ],
        email: [
          '[data-testid="business-email"]',
          '.business-info__email',
          '.email',
          '[href^="mailto:"]',
          '.contact-email'
        ],
        address: [
          '[data-testid="business-address"]',
          '.business-info__address',
          '.address',
          '.location',
          '.business-location'
        ],
        description: [
          '[data-testid="business-description"]',
          '.business-info__description', 
          '.about-section',
          '.description'
        ]
      };

      // Extract website
      let website = basicCompany.website;
      for (const selector of detailSelectors.website) {
        const element = $(selector).first();
        if (element.length > 0) {
          website = element.attr('href') || element.text().trim();
          if (website && website.startsWith('http')) break;
        }
      }

      // Extract phone
      let phone = basicCompany.phone;
      for (const selector of detailSelectors.phone) {
        const element = $(selector).first();
        if (element.length > 0) {
          phone = element.attr('href')?.replace('tel:', '') || element.text().trim();
          if (phone && DataExtractor.isValidPhone(phone)) break;
        }
      }

      // Extract email
      let email = basicCompany.email;
      for (const selector of detailSelectors.email) {
        const element = $(selector).first();
        if (element.length > 0) {
          email = element.attr('href')?.replace('mailto:', '') || element.text().trim();
          if (email && DataExtractor.isValidEmail(email)) break;
        }
      }

      // Extract additional data from page text
      const pageText = $('body').text();
      if (!email) {
        const emails = DataExtractor.extractEmails(pageText);
        email = emails.length > 0 ? emails[0] : null;
      }
      if (!phone) {
        const phones = DataExtractor.extractPhones(pageText);
        phone = phones.length > 0 ? phones[0] : null;
      }

      return {
        ...basicCompany,
        website: website || basicCompany.website,
        domain: website ? DataExtractor.extractDomain(website) : basicCompany.domain,
        phone: phone || basicCompany.phone,
        email: email || basicCompany.email,
      };

    } catch (error) {
      // Return basic company if detailed extraction fails
      await this.storage.addLog({
        level: "warning",
        message: `Failed to get details for ${basicCompany.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId,
      });
      return basicCompany;
    }
  }
}