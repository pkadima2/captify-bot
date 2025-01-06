import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users, Package, MessageSquare, BookOpen, DollarSign, Instagram, Facebook, Twitter, Linkedin, Music2, Briefcase, Coffee, Smile, Lightbulb, Megaphone } from "lucide-react";

export const Generator = () => {
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState({
    idea: "",
    caption: "",
    hashtags: "",
  });
  const { toast } = useToast();

  const goals = [
    { id: "grow", label: "Grow Followers", icon: Users },
    { id: "promote", label: "Promote Products", icon: Package },
    { id: "engage", label: "Drive Engagement", icon: MessageSquare },
    { id: "share", label: "Share Knowledge", icon: BookOpen },
    { id: "sell", label: "Sell Products/Services", icon: DollarSign },
  ];

  const platforms = [
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "facebook", label: "Facebook", icon: Facebook },
    { id: "twitter", label: "Twitter", icon: Twitter },
    { id: "linkedin", label: "LinkedIn", icon: Linkedin },
    { id: "tiktok", label: "TikTok", icon: Music2 },
  ];

  const tones = [
    { id: "professional", label: "Professional", icon: Briefcase },
    { id: "casual", label: "Casual", icon: Coffee },
    { id: "humorous", label: "Humorous", icon: Smile },
    { id: "inspirational", label: "Inspirational", icon: Lightbulb },
    { id: "persuasive", label: "Persuasive", icon: Megaphone },
  ];

  const handleGenerate = async () => {
    if (!niche || !goal || !platform || !tone) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields before generating content.",
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
          <div className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="niche">Your Niche</Label>
              <Input
                id="niche"
                placeholder="e.g., Fitness, Fashion, Technology"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>

            <div className="space-y-4">
              <Label>What's your goal?</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {goals.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={goal === item.id ? "default" : "outline"}
                      className="h-auto flex-col gap-2 p-4"
                      onClick={() => setGoal(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs text-center">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Choose your platform</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {platforms.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={platform === item.id ? "default" : "outline"}
                      className="h-auto flex-col gap-2 p-4"
                      onClick={() => setPlatform(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Select your tone</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {tones.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={tone === item.id ? "default" : "outline"}
                      className="h-auto flex-col gap-2 p-4"
                      onClick={() => setTone(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <span className="animate-spin mr-2">⚡</span>
              ) : (
                <span className="mr-2">⚡</span>
              )}
              Generate Content Ideas
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