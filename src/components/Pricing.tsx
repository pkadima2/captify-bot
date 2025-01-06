import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: "€0",
    interval: "/month",
    features: [
      "3 content requests every 10 days",
      "Basic content generation",
      "Standard support",
      "Single platform focus",
    ],
    buttonText: "Current Plan",
    disabled: true,
  },
  {
    name: "Pro Monthly",
    price: "€3.99",
    interval: "/month",
    features: [
      "Unlimited content requests",
      "Advanced AI-powered generation",
      "Priority 24/7 support",
      "Multi-platform content strategy",
      "Custom branding options",
      "Advanced analytics",
      "Content calendar",
      "Hashtag optimization",
    ],
    priceId: "price_1QcYNsDPEDopwk6yNS4GUnAA",
    buttonText: "Subscribe",
    popular: true,
  },
  {
    name: "Pro Yearly",
    price: "€45",
    interval: "/year",
    features: [
      "Everything in Pro Monthly",
      "🔥 Save over 25%",
      "🎁 2 months free",
      "Priority feature access",
    ],
    priceId: "plink_1QcYhbDPEDopwk6ypPV15fON",
    buttonText: "Subscribe",
    badge: "Best Value",
  },
];

export const Pricing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async (priceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId },
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="py-12">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Choose Your Plan
          </h2>
          <p className="max-w-[700px] text-muted-foreground">
            Start creating engaging content today
          </p>
        </div>
        <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col p-6 ${
                plan.popular ? "border-primary shadow-lg" : ""
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                  {plan.badge}
                </span>
              )}
              {plan.popular && (
                <span className="absolute -top-3 left-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
                  Most Popular
                </span>
              )}
              <div className="flex-1 space-y-4">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="ml-1 text-muted-foreground">
                    {plan.interval}
                  </span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                className="mt-6 w-full"
                variant={plan.popular ? "default" : "outline"}
                disabled={plan.disabled}
                onClick={() => plan.priceId && handleSubscribe(plan.priceId)}
              >
                {plan.buttonText}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
