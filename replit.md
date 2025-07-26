# Trustpilot Scraper Application

## Overview

This is a production-ready full-stack web application that performs real web scraping of Trustpilot business data. The application features a React frontend with glass-morphism design using shadcn/ui components and a comprehensive Node.js/Express backend with TypeScript. The system includes advanced CORS handling, intelligent data extraction, real-time monitoring, and multi-format data export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.
User requirement: NO mock/demo/fallback/fake data - only real scraping implementation.

## Recent Changes (Latest)

✓ Implemented fully functional Trustpilot scraper with real web scraping capabilities
✓ Added advanced CORS proxy service with automatic failover across multiple proxies
✓ Created intelligent data extraction system for emails, phones, addresses, and cities
✓ Built robust HTML parsing with multiple selector fallbacks for Trustpilot's dynamic structure
✓ Added real Excel export functionality using XLSX library
✓ Implemented comprehensive error handling and retry mechanisms
✓ Fixed all TypeScript compilation errors and type safety issues
✓ Updated scraper with exact DOM selectors based on current Trustpilot HTML structure
✓ Fixed "Unknown Company" extraction issue by targeting precise business card elements
✓ Enhanced data extraction to capture company names, ratings, review counts, and locations accurately

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for the client-side application
- **Vite** as the build tool and development server
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with a custom design system
- **TanStack Query** for server state management and API caching
- **Wouter** for client-side routing
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Express.js** server with TypeScript
- **Drizzle ORM** configured for PostgreSQL database operations
- **In-memory storage fallback** for development/testing without database
- **RESTful API** design with comprehensive error handling
- **Real-time progress tracking** through polling-based updates

### Monorepo Structure
The application uses a monorepo structure with:
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schema definitions
- Unified build and deployment pipeline

## Key Components

### Data Models
The application defines four main data entities:
- **ScrapingUrls**: URLs to be scraped with status tracking
- **Companies**: Extracted business data from Trustpilot
- **ScrapingJobs**: Job management with progress tracking
- **Logs**: System logging with different severity levels

### Frontend Components
- **Header**: Application branding and feature highlights
- **URLManagement**: Interface for adding/removing Trustpilot URLs
- **AdvancedSettings**: Configurable scraping parameters
- **ControlPanel**: Start/stop scraping operations and data export
- **ProgressTracking**: Real-time job status and statistics
- **DataTable**: Searchable/filterable results display
- **LoggingSection**: Real-time system logs with filtering

### Backend Services
- **TrustpilotScraper**: Production-grade scraping engine with real web scraping capabilities
- **CorsProxyService**: Advanced CORS handling with multiple proxy failover
- **DataExtractor**: Intelligent extraction of emails, phones, addresses, and other business data
- **ExportService**: Full-featured data export (CSV, Excel XLSX, JSON)
- **Storage Interface**: Abstracted data persistence layer with TypeScript safety

## Data Flow

1. **URL Management**: Users add Trustpilot category or business URLs through the frontend
2. **Job Creation**: Starting a scraping job creates a new job record with configured settings
3. **Scraping Process**: Backend iterates through URLs, extracts company data, and updates progress
4. **Real-time Updates**: Frontend polls for job status, company data, and logs every 2-5 seconds
5. **Data Export**: Users can export collected data in CSV, Excel, or JSON formats
6. **Error Handling**: Failed requests are logged and retried based on configuration

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database operations
- **axios**: HTTP client for CORS proxy requests
- **cheerio**: Advanced HTML parsing and DOM manipulation for real web scraping
- **xlsx**: Professional Excel file generation and export
- **@tanstack/react-query**: Server state management with real-time updates
- **@radix-ui/***: Headless UI component primitives

### Development Tools
- **Vite**: Build tool with HMR support
- **TypeScript**: Type safety across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundler for production

### Optional Integrations
- **Replit**: Development environment integration
- **CORS Proxy**: Configurable proxy for cross-origin requests

## Deployment Strategy

### Development
- Vite dev server with HMR for frontend development
- Express server with tsx for TypeScript execution
- In-memory storage fallback when database is unavailable
- Environment-specific configuration through process.env

### Production Build
- Vite builds optimized frontend bundle to `dist/public`
- ESBuild compiles server code to `dist/index.js`
- Single Node.js process serves both API and static files
- Database migrations managed through Drizzle Kit

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required for production)
- **NODE_ENV**: Environment mode (development/production)
- Graceful fallback to in-memory storage for development

The application is designed to be deployed on platforms like Replit, Vercel, or traditional VPS hosting with minimal configuration required.