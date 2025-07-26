import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface ProgressTrackingProps {
  job: any;
}

export default function ProgressTracking({ job }: ProgressTrackingProps) {
  const isRunning = job?.status === "running";
  const progress = job ? (job.processedUrls / Math.max(job.totalUrls, 1)) * 100 : 0;

  const formatTime = (startTime: string) => {
    if (!startTime) return "00:00";
    const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const stats = [
    {
      label: "Total URLs",
      value: job?.totalUrls || 0,
      color: "from-blue-50 to-blue-100 text-blue-600",
    },
    {
      label: "Processed",
      value: job?.processedUrls || 0,
      color: "from-green-50 to-green-100 text-green-600",
    },
    {
      label: "Companies",
      value: job?.totalCompanies || 0,
      color: "from-purple-50 to-purple-100 text-purple-600",
    },
    {
      label: "Reviews",
      value: "N/A", // This would need to be tracked separately
      color: "from-yellow-50 to-yellow-100 text-yellow-600",
    },
    {
      label: "Errors",
      value: job?.errors || 0,
      color: "from-red-50 to-red-100 text-red-600",
    },
    {
      label: "Time",
      value: job?.startedAt ? formatTime(job.startedAt) : "00:00",
      color: "from-gray-50 to-gray-100 text-gray-600",
    },
  ];

  return (
    <Card className="glass-card mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-500" />
            Real-time Progress
          </CardTitle>
          <div className="flex items-center text-sm text-gray-600">
            {isRunning && <div className="spinner mr-2" />}
            <span>{isRunning ? "Processing..." : "Ready to start"}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-3" />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-r ${stat.color} p-4 rounded-xl text-center`}
            >
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm font-medium opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
