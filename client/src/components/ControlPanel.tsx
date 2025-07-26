import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Pause, Download, Trash2 } from "lucide-react";
import AdvancedSettings, { ScrapingSettings } from "./AdvancedSettings";

interface ControlPanelProps {
  onStartScraping: (urls: string[], settings: ScrapingSettings) => void;
  onStopScraping: () => void;
  onExportData: (format: string) => void;
  isRunning: boolean;
  isStarting: boolean;
  isExporting: boolean;
}

export default function ControlPanel({
  onStartScraping,
  onStopScraping,
  onExportData,
  isRunning,
  isStarting,
  isExporting,
}: ControlPanelProps) {
  const [settings, setSettings] = useState<ScrapingSettings>({
    reviewLimit: 50,
    delay: 2000,
    concurrentRequests: 2,
    minRating: 0,
    corsProxy: "auto",
    retryAttempts: 3,
    outputFormat: "xlsx",
    includeImages: true,
  });

  const { data: urls = [] } = useQuery({
    queryKey: ["/api/scraping/urls"],
  });

  const handleStartScraping = () => {
    if (urls.length === 0) {
      return;
    }
    onStartScraping(urls.map((url: any) => url.url), settings);
  };

  const handleClearData = async () => {
    try {
      await fetch("/api/companies", { method: "DELETE" });
      await fetch("/api/scraping/urls", { method: "DELETE" });
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
    }
  };

  return (
    <>
      <AdvancedSettings settings={settings} onSettingsChange={setSettings} />
      
      <Card className="glass-card mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleStartScraping}
                disabled={isStarting || isRunning || urls.length === 0}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 px-8"
              >
                {isStarting ? (
                  <div className="spinner mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {isStarting ? "Starting..." : "Start Scraping"}
              </Button>

              <Button
                onClick={onStopScraping}
                disabled={!isRunning}
                variant="destructive"
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>

              <Button
                disabled={isRunning}
                variant="outline"
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => onExportData(settings.outputFormat)}
                disabled={isExporting}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                {isExporting ? (
                  <div className="spinner mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export Data
              </Button>

              <Button
                onClick={handleClearData}
                variant="secondary"
                className="bg-gray-500 text-white hover:bg-gray-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
