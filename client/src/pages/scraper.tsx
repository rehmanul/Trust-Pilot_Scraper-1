import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import URLManagement from "@/components/URLManagement";
import AdvancedSettings from "@/components/AdvancedSettings";
import ControlPanel from "@/components/ControlPanel";
import ProgressTracking from "@/components/ProgressTracking";
import DataTable from "@/components/DataTable";
import LoggingSection from "@/components/LoggingSection";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function ScraperPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Queries
  const { data: currentJob } = useQuery<any>({
    queryKey: ["/api/scraping/current-job"],
    refetchInterval: selectedJobId ? 2000 : false,
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    refetchInterval: selectedJobId ? 5000 : false,
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["/api/logs", selectedJobId],
    refetchInterval: selectedJobId ? 2000 : false,
    enabled: !!selectedJobId,
  });

  const { data: urls = [] } = useQuery<any[]>({
    queryKey: ["/api/scraping/urls"],
  });

  // Mutations
  const startScrapingMutation = useMutation({
    mutationFn: async (data: { urls: string[]; settings: any }) => {
      const response = await apiRequest("POST", "/api/scraping/start", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ["/api/scraping"] });
      toast({
        title: "Scraping Started",
        description: "The scraping process has been initiated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to start scraping: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const stopScrapingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scraping/stop", {});
      return response.json();
    },
    onSuccess: () => {
      setSelectedJobId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/scraping"] });
      toast({
        title: "Scraping Stopped",
        description: "The scraping process has been stopped.",
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async (format: string) => {
      const response = await apiRequest("POST", "/api/export", { format });
      return response.blob();
    },
    onSuccess: (blob, format) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trustpilot-data.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export Complete",
        description: "Your data has been exported successfully.",
      });
    },
  });

  useEffect(() => {
    if (currentJob && currentJob.id && currentJob.status !== "completed" && currentJob.status !== "error") {
      setSelectedJobId(currentJob.id);
    }
  }, [currentJob]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <Header />
        
        <URLManagement />
        
        {/* AdvancedSettings moved to ControlPanel */}
        
        <ControlPanel
          onStartScraping={(urls, settings) => startScrapingMutation.mutate({ urls, settings })}
          onStopScraping={() => stopScrapingMutation.mutate()}
          onExportData={(format) => exportDataMutation.mutate(format)}
          isRunning={!!selectedJobId && currentJob && currentJob.status === "running"}
          isStarting={startScrapingMutation.isPending}
          isExporting={exportDataMutation.isPending}
        />
        
        <ProgressTracking job={currentJob} />
        
        <DataTable companies={companies} />
        
        <LoggingSection logs={logs} />
      </div>
    </div>
  );
}
