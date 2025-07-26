# Trustpilot Scraper Application

## Overview

This is a full-stack web application designed to scrape business data from Trustpilot. The application features a React frontend with a modern UI built using shadcn/ui components and a Node.js/Express backend with TypeScript. The system allows users to manage scraping URLs, configure scraping settings, monitor progress in real-time, and export collected data in multiple formats.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **TrustpilotScraper**: Core scraping logic with rate limiting and error handling
- **ExportService**: Multi-format data export (CSV, Excel, JSON)
- **Storage Interface**: Abstracted data persistence layer

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
- **axios**: HTTP client for external API requests
- **cheerio**: HTML parsing for web scraping
- **@tanstack/react-query**: Server state management
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