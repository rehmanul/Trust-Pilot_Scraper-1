import { type ScrapingUrl, type InsertScrapingUrl, type Company, type InsertCompany, type ScrapingJob, type InsertScrapingJob, type Log, type InsertLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Scraping URLs
  getScrapingUrls(): Promise<ScrapingUrl[]>;
  addScrapingUrl(url: InsertScrapingUrl): Promise<ScrapingUrl>;
  removeScrapingUrl(id: string): Promise<void>;
  clearScrapingUrls(): Promise<void>;

  // Companies
  getCompanies(): Promise<Company[]>;
  addCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company>;
  clearCompanies(): Promise<void>;

  // Scraping Jobs
  getCurrentJob(): Promise<ScrapingJob | undefined>;
  createScrapingJob(job: InsertScrapingJob): Promise<ScrapingJob>;
  updateScrapingJob(id: string, updates: Partial<ScrapingJob>): Promise<ScrapingJob>;

  // Logs
  getLogs(jobId?: string): Promise<Log[]>;
  addLog(log: InsertLog): Promise<Log>;
  clearLogs(): Promise<void>;
}

export class MemStorage implements IStorage {
  private scrapingUrls: Map<string, ScrapingUrl> = new Map();
  private companies: Map<string, Company> = new Map();
  private scrapingJobs: Map<string, ScrapingJob> = new Map();
  private logs: Map<string, Log> = new Map();

  // Scraping URLs
  async getScrapingUrls(): Promise<ScrapingUrl[]> {
    return Array.from(this.scrapingUrls.values());
  }

  async addScrapingUrl(url: InsertScrapingUrl): Promise<ScrapingUrl> {
    const id = randomUUID();
    const scrapingUrl: ScrapingUrl = { 
      ...url, 
      id, 
      createdAt: new Date(),
      status: "pending"
    };
    this.scrapingUrls.set(id, scrapingUrl);
    return scrapingUrl;
  }

  async removeScrapingUrl(id: string): Promise<void> {
    this.scrapingUrls.delete(id);
  }

  async clearScrapingUrls(): Promise<void> {
    this.scrapingUrls.clear();
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async addCompany(company: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const newCompany: Company = { 
      ...company, 
      id, 
      createdAt: new Date(),
      status: "pending"
    };
    this.companies.set(id, newCompany);
    return newCompany;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const company = this.companies.get(id);
    if (!company) {
      throw new Error("Company not found");
    }
    const updatedCompany = { ...company, ...updates };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }

  async clearCompanies(): Promise<void> {
    this.companies.clear();
  }

  // Scraping Jobs
  async getCurrentJob(): Promise<ScrapingJob | undefined> {
    const jobs = Array.from(this.scrapingJobs.values());
    return jobs.find(job => job.status === "running" || job.status === "pending");
  }

  async createScrapingJob(job: InsertScrapingJob): Promise<ScrapingJob> {
    const id = randomUUID();
    const scrapingJob: ScrapingJob = { 
      ...job, 
      id, 
      createdAt: new Date()
    };
    this.scrapingJobs.set(id, scrapingJob);
    return scrapingJob;
  }

  async updateScrapingJob(id: string, updates: Partial<ScrapingJob>): Promise<ScrapingJob> {
    const job = this.scrapingJobs.get(id);
    if (!job) {
      throw new Error("Scraping job not found");
    }
    const updatedJob = { ...job, ...updates };
    this.scrapingJobs.set(id, updatedJob);
    return updatedJob;
  }

  // Logs
  async getLogs(jobId?: string): Promise<Log[]> {
    const logs = Array.from(this.logs.values());
    if (jobId) {
      return logs.filter(log => log.jobId === jobId);
    }
    return logs.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
  }

  async addLog(log: InsertLog): Promise<Log> {
    const id = randomUUID();
    const newLog: Log = { 
      ...log, 
      id, 
      timestamp: new Date()
    };
    this.logs.set(id, newLog);
    return newLog;
  }

  async clearLogs(): Promise<void> {
    this.logs.clear();
  }
}

export const storage = new MemStorage();
