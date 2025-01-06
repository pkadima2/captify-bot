import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Generator } from "@/components/Generator";
import { Features } from "@/components/Features";
import { Pricing } from "@/components/Pricing";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Generator />
        <Features />
        <Pricing />
      </main>
    </div>
  );
};

export default Index;