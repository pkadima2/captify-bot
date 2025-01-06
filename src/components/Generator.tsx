import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Sparkles } from "lucide-react";

export const Generator = () => {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!topic) {
      toast({
        title: "Please enter a topic",
        description: "You need to provide a topic to generate content.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setResult("This is a sample generated content for your social media post. #awesome #content #socialmedia");
      setLoading(false);
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast({
      title: "Copied to clipboard",
      description: "The generated content has been copied to your clipboard.",
    });
  };

  return (
    <section className="py-12">
      <div className="container px-4 md:px-6">
        <Card className="p-6 glass-card animate-in">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">What would you like to post about?</Label>
              <Input
                id="topic"
                placeholder="Enter your topic or idea..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
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
            {result && (
              <div className="space-y-2">
                <Label>Generated Content</Label>
                <div className="relative">
                  <Textarea
                    value={result}
                    readOnly
                    className="min-h-[100px] pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleCopy}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};