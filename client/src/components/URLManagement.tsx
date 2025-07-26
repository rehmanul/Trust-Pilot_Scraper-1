import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, Plus, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const DATA_FIELDS = [
  "Company Name", "Company Type", "Review Count", "Location/City",
  "Phone Number", "Email Address", "Domain", "Rating Score",
  "Trustpilot URL", "Description", "Address", "Website URL"
];

const PRESET_URLS = [
  { name: "Tools & Equipment", url: "https://it.trustpilot.com/categories/tools_equipment" },
  { name: "Construction", url: "https://it.trustpilot.com/categories/construction_manufacturi" },
  { name: "Technology", url: "https://it.trustpilot.com/categories/electronics_technology" },
  { name: "Healthcare", url: "https://it.trustpilot.com/categories/health_medical" },
  { name: "Finance", url: "https://it.trustpilot.com/categories/money_insurance" },
];

export default function URLManagement() {
  const [newUrl, setNewUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: urls = [] } = useQuery({
    queryKey: ["/api/scraping/urls"],
  });

  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/scraping/urls", { url });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scraping/urls"] });
      setNewUrl("");
      toast({ title: "URL Added", description: "URL has been added successfully." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add URL: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const removeUrlMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scraping/urls/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scraping/urls"] });
      toast({ title: "URL Removed", description: "URL has been removed successfully." });
    },
  });

  const handleAddUrl = () => {
    if (!newUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL.",
        variant: "destructive",
      });
      return;
    }

    if (!newUrl.includes("trustpilot.com")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Trustpilot URL.",
        variant: "destructive",
      });
      return;
    }

    addUrlMutation.mutate(newUrl);
  };

  const handleAddPreset = (url: string) => {
    addUrlMutation.mutate(url);
  };

  return (
    <>
      {/* Data Fields Alert */}
      <Card className="glass-card mb-8 border-l-4 border-blue-500">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Extracted Data Fields</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {DATA_FIELDS.map((field, index) => (
                  <span key={index} className="text-sm text-gray-600">
                    • {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URL Management */}
      <Card className="glass-card mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Link className="w-6 h-6 text-blue-500" />
            URL Management System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Enter Trustpilot URL (e.g., https://it.trustpilot.com/categories/tools_equipment)"
              className="flex-1"
            />
            <Button
              onClick={handleAddUrl}
              disabled={addUrlMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add URL
            </Button>
          </div>

          {/* URL List */}
          {urls.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
              {urls.map((url: any) => (
                <div key={url.id} className="flex items-center justify-between bg-white p-3 rounded-lg border-l-4 border-blue-500">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{url.name}</div>
                    <div className="font-mono text-sm text-gray-600 truncate">{url.url}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUrlMutation.mutate(url.id)}
                    className="text-red-500 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Preset URLs */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Quick Add Presets:</h4>
            <div className="flex flex-wrap gap-2">
              {PRESET_URLS.map((preset, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-blue-500 hover:text-white transition-colors px-3 py-2"
                  onClick={() => handleAddPreset(preset.url)}
                >
                  {preset.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
