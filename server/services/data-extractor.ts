export class DataExtractor {
  // Extract email addresses from text content
  static extractEmails(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  // Extract phone numbers from text content
  static extractPhones(text: string): string[] {
    const phoneRegexes = [
      // International format: +39 123 456 7890
      /\+\d{1,3}\s?\d{1,4}\s?\d{1,4}\s?\d{1,9}/g,
      // Standard format: (123) 456-7890
      /\(\d{3}\)\s?\d{3}-?\d{4}/g,
      // Simple format: 123-456-7890 or 123.456.7890
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
      // European format: 0123 456 789
      /\b0\d{1,4}\s?\d{1,4}\s?\d{1,9}\b/g,
      // Mobile format: +39 3xx xxx xxxx
      /\+\d{2}\s?3\d{2}\s?\d{3}\s?\d{4}/g,
    ];

    const phones: string[] = [];
    phoneRegexes.forEach(regex => {
      const matches = text.match(regex) || [];
      phones.push(...matches);
    });

    return [...new Set(phones)]; // Remove duplicates
  }

  // Extract domain from various URL formats
  static extractDomain(url: string): string {
    try {
      if (url.includes('/review/')) {
        // Extract domain from Trustpilot review URL
        const match = url.match(/\/review\/([^/?]+)/);
        return match ? match[1] : '';
      }
      
      // Standard URL parsing
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      // Fallback for invalid URLs
      const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s?]+)/);
      return domainMatch ? domainMatch[1] : '';
    }
  }

  // Extract address information
  static extractAddress(text: string): string | null {
    const addressPatterns = [
      // Street address patterns
      /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Circle|Cir|Court|Ct|Place|Pl)[\s,]*/gi,
      // European address patterns
      /(?:Via|Viale|Piazza|Corso|Strada)\s+[A-Za-z\s]+\d*[\s,]*/gi,
      // P.O. Box patterns
      /P\.?O\.?\s*Box\s+\d+/gi,
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && match[0].length > 10) {
        return match[0].trim();
      }
    }

    return null;
  }

  // Extract city names (basic pattern matching)
  static extractCity(text: string): string | null {
    // Common city patterns in addresses
    const cityPatterns = [
      // City, State/Province format
      /,\s*([A-Za-z\s]+),?\s*\d{5}/g,
      // European city patterns
      /,\s*(\d{5})\s+([A-Za-z\s]+)/g,
      // Italian city patterns
      /,\s*([A-Za-z\s]+)\s*\(\w{2}\)/g,
    ];

    for (const pattern of cityPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length > 0) {
        const cityMatch = matches[0][1] || matches[0][2];
        if (cityMatch && cityMatch.length > 2) {
          return cityMatch.trim();
        }
      }
    }

    return null;
  }

  // Extract rating from various text formats
  static extractRating(text: string): number | null {
    const ratingPatterns = [
      // Decimal rating: 4.5 stars, 3.2/5
      /(\d+\.?\d*)\s*(?:\/\s*5|stars?|★)/gi,
      // Simple decimal
      /(\d+\.\d+)/g,
    ];

    for (const pattern of ratingPatterns) {
      const match = text.match(pattern);
      if (match) {
        const rating = parseFloat(match[1]);
        if (rating >= 0 && rating <= 5) {
          return rating;
        }
      }
    }

    return null;
  }

  // Extract review count from text
  static extractReviewCount(text: string): number | null {
    const countPatterns = [
      // "1,234 reviews"
      /([\d,]+)\s*reviews?/gi,
      // "Based on 123 reviews"
      /based\s+on\s+([\d,]+)/gi,
      // Simple number patterns
      /([\d,]+)\s*(?:review|rating|opinion)s?/gi,
    ];

    for (const pattern of countPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''));
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }

    return null;
  }

  // Clean and validate extracted data
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, ' ') // Newlines to spaces
      .trim();
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate phone format
  static isValidPhone(phone: string): boolean {
    const cleanPhone = phone.replace(/[\s\-\.()]/g, '');
    return cleanPhone.length >= 7 && cleanPhone.length <= 15 && /^\+?\d+$/.test(cleanPhone);
  }
}