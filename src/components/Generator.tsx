import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

export const Generator = () => {
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState({
    idea: "",
    caption: "",
    hashtags: "",
  });
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!niche) {
      toast({
        title: "Please enter your niche",
        description: "We need to know your niche to generate relevant content.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    // Simulate API call with placeholder content
    setTimeout(() => {
      setGeneratedContent({
        idea: `Create a ${tone} post about ${niche} trends for ${platform}`,
        caption: `🚀 Discover the latest ${niche} innovations that are transforming the industry! #${niche} #Innovation`,
        hashtags: `#${niche} #${platform} #ContentCreator #Growth #Social`,
      });
      setLoading(false);
      toast({
        title: "Content generated!",
        description: "Your social media content has been generated successfully.",
      });
    }, 1500);
  };

  return (
    <section className="py-12">
      <div className="container px-4 md:px-6">
        <Card className="p-6 glass-card animate-in">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="niche">Your Niche</Label>
              <Input
                id="niche"
                placeholder="e.g., Digital Marketing, Fitness, Tech"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Content Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="humorous">Humorous</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Content
            </Button>

            {(generatedContent.idea || generatedContent.caption || generatedContent.hashtags) && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Post Idea</Label>
                  <Textarea
                    value={generatedContent.idea}
                    readOnly
                    className="min-h-[60px]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Caption</Label>
                  <Textarea
                    value={generatedContent.caption}
                    readOnly
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hashtags</Label>
                  <Textarea
                    value={generatedContent.hashtags}
                    readOnly
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};