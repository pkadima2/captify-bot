import { Card } from "@/components/ui/card";
import { Sparkles, MessageSquare, Hash, Zap } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Ideas",
    description: "Generate creative and engaging post ideas tailored to your niche",
  },
  {
    icon: MessageSquare,
    title: "Smart Captions",
    description: "Create compelling captions that drive engagement and reach",
  },
  {
    icon: Hash,
    title: "Hashtag Suggestions",
    description: "Get relevant hashtag recommendations to maximize your visibility",
  },
  {
    icon: Zap,
    title: "Quick Responses",
    description: "Generate thoughtful replies to comments automatically",
  },
];

export const Features = () => {
  return (
    <section className="py-12 bg-secondary/50">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6 glass-card animate-in">
              <feature.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};