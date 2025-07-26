import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";

export interface ScrapingSettings {
  reviewLimit: number;
  delay: number;
  concurrentRequests: number;
  minRating: number;
  corsProxy: string;
  retryAttempts: number;
  outputFormat: string;
  includeImages: boolean;
}

interface AdvancedSettingsProps {
  settings: ScrapingSettings;
  onSettingsChange: (settings: ScrapingSettings) => void;
}

export default function AdvancedSettings({ 
  settings = {
    reviewLimit: 50,
    delay: 2000,
    concurrentRequests: 2,
    minRating: 0,
    corsProxy: "auto",
    retryAttempts: 3,
    outputFormat: "xlsx",
    includeImages: true,
  },
  onSettingsChange 
}: AdvancedSettingsProps) {
  const updateSetting = (key: keyof ScrapingSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="glass-card mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-purple-500" />
          Advanced Scraping Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label htmlFor="reviewLimit">Review Limit per Company</Label>
            <Input
              id="reviewLimit"
              type="number"
              value={settings.reviewLimit}
              onChange={(e) => updateSetting("reviewLimit", parseInt(e.target.value))}
              min={1}
              max={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay">Delay Between Requests (ms)</Label>
            <Input
              id="delay"
              type="number"
              value={settings.delay}
              onChange={(e) => updateSetting("delay", parseInt(e.target.value))}
              min={500}
              max={10000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="concurrentRequests">Concurrent Requests</Label>
            <Select
              value={settings.concurrentRequests.toString()}
              onValueChange={(value) => updateSetting("concurrentRequests", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (Safe)</SelectItem>
                <SelectItem value="2">2 (Recommended)</SelectItem>
                <SelectItem value="3">3 (Fast)</SelectItem>
                <SelectItem value="5">5 (Aggressive)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minRating">Min Rating Filter</Label>
            <Select
              value={settings.minRating.toString()}
              onValueChange={(value) => updateSetting("minRating", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Filter</SelectItem>
                <SelectItem value="1">1+ Stars</SelectItem>
                <SelectItem value="2">2+ Stars</SelectItem>
                <SelectItem value="3">3+ Stars</SelectItem>
                <SelectItem value="4">4+ Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="corsProxy">CORS Proxy</Label>
            <Select
              value={settings.corsProxy}
              onValueChange={(value) => updateSetting("corsProxy", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-Select</SelectItem>
                <SelectItem value="cors-anywhere">cors-anywhere.herokuapp.com</SelectItem>
                <SelectItem value="allorigins">api.allorigins.win</SelectItem>
                <SelectItem value="thingproxy">thingproxy.freeboard.io</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retryAttempts">Retry Attempts</Label>
            <Input
              id="retryAttempts"
              type="number"
              value={settings.retryAttempts}
              onChange={(e) => updateSetting("retryAttempts", parseInt(e.target.value))}
              min={1}
              max={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputFormat">Output Format</Label>
            <Select
              value={settings.outputFormat}
              onValueChange={(value) => updateSetting("outputFormat", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeImages"
                checked={settings.includeImages}
                onCheckedChange={(checked) => updateSetting("includeImages", checked)}
              />
              <Label htmlFor="includeImages" className="text-sm">
                Include images
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
