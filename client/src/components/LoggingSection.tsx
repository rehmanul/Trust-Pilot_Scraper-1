import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Eraser, Download } from "lucide-react";

interface LoggingSectionProps {
  logs: any[];
}

export default function LoggingSection({ logs = [] }: LoggingSectionProps) {
  const logAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (level: string) => {
    const colors = {
      info: "text-blue-400",
      success: "text-green-400",
      warning: "text-yellow-400",
      error: "text-red-400",
    };
    return colors[level as keyof typeof colors] || "text-gray-400";
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      window.location.reload();
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  const handleDownloadLogs = () => {
    const logText = logs
      .map((log) => `[${new Date(log.timestamp).toLocaleString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join("\n");
    
    const blob = new Blob([logText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scraping-logs.txt";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-gray-500" />
            System Logs
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearLogs}
              className="text-gray-500 hover:text-gray-700"
            >
              <Eraser className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadLogs}
              className="text-gray-500 hover:text-gray-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={logAreaRef}
          className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">System ready. Logs will appear here...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                <div className="text-gray-500 text-xs">
                  [{new Date(log.timestamp).toLocaleString()}]
                </div>
                <div className={getLogColor(log.level)}>
                  [{log.level.toUpperCase()}] {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
