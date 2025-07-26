import { Badge } from "@/components/ui/badge";
import { Globe, Shield, Download, TrendingUp } from "lucide-react";

export default function Header() {
  return (
    <div className="glass-card rounded-3xl p-8 text-center mb-8 shadow-2xl">
      <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4 flex items-center justify-center gap-3">
        <Globe className="w-12 h-12" />
        Professional Trustpilot Scraper
      </h1>
      <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-6">
        Advanced web scraping interface for comprehensive Trustpilot business data collection with real-time monitoring and export capabilities
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 px-4 py-2">
          <Shield className="w-4 h-4 mr-2" />
          CORS Protected
        </Badge>
        <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-2">
          <Download className="w-4 h-4 mr-2" />
          Multi-Format Export
        </Badge>
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 px-4 py-2">
          <TrendingUp className="w-4 h-4 mr-2" />
          Real-time Analytics
        </Badge>
      </div>
    </div>
  );
}
