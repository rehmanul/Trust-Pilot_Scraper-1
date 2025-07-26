import { IStorage } from "../storage";
import { Company } from "@shared/schema";
import * as XLSX from 'xlsx';

export class ExportService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async exportData(companies: Company[], format: string) {
    switch (format.toLowerCase()) {
      case "csv":
        return this.exportToCsv(companies);
      case "xlsx":
        return this.exportToExcel(companies);
      case "json":
        return this.exportToJson(companies);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToCsv(companies: Company[]) {
    const headers = [
      "Company Name",
      "Company Type", 
      "Domain",
      "City",
      "Phone",
      "Email",
      "Rating",
      "Review Count",
      "Trustpilot URL",
      "Description",
      "Address",
      "Website",
      "Status"
    ];

    const csvContent = [
      headers.join(","),
      ...companies.map(company => [
        this.escapeCsvField(company.name || ""),
        this.escapeCsvField(company.type || ""),
        this.escapeCsvField(company.domain || ""),
        this.escapeCsvField(company.city || ""),
        this.escapeCsvField(company.phone || ""),
        this.escapeCsvField(company.email || ""),
        company.rating || "",
        company.reviewCount || "",
        this.escapeCsvField(company.trustpilotUrl || ""),
        this.escapeCsvField(company.description || ""),
        this.escapeCsvField(company.address || ""),
        this.escapeCsvField(company.website || ""),
        this.escapeCsvField(company.status || ""),
      ].join(","))
    ].join("\n");

    return {
      data: Buffer.from(csvContent, "utf-8"),
      filename: "trustpilot-companies.csv",
      mimeType: "text/csv",
    };
  }

  private exportToJson(companies: Company[]) {
    const jsonData = {
      exportDate: new Date().toISOString(),
      totalCompanies: companies.length,
      companies: companies.map(company => ({
        id: company.id,
        name: company.name,
        type: company.type,
        domain: company.domain,
        city: company.city,
        phone: company.phone,
        email: company.email,
        rating: company.rating,
        reviewCount: company.reviewCount,
        trustpilotUrl: company.trustpilotUrl,
        description: company.description,
        address: company.address,
        website: company.website,
        status: company.status,
        createdAt: company.createdAt,
      })),
    };

    return {
      data: Buffer.from(JSON.stringify(jsonData, null, 2), "utf-8"),
      filename: "trustpilot-companies.json",
      mimeType: "application/json",
    };
  }

  private exportToExcel(companies: Company[]) {
    const worksheetData = [
      [
        "Company Name", "Company Type", "Domain", "City", "Phone", "Email",
        "Rating", "Review Count", "Trustpilot URL", "Description", "Address", "Website", "Status"
      ],
      ...companies.map(company => [
        company.name || "",
        company.type || "",
        company.domain || "",
        company.city || "",
        company.phone || "",
        company.email || "",
        company.rating || "",
        company.reviewCount || "",
        company.trustpilotUrl || "",
        company.description || "",
        company.address || "",
        company.website || "",
        company.status || "",
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Companies");

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      data: excelBuffer,
      filename: "trustpilot-companies.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  private escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}