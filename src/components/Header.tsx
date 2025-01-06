import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center space-x-4">
          <span className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            EngagePerfect
          </span>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <Button variant="ghost">Features</Button>
          <Button variant="ghost">Pricing</Button>
          <Button variant="ghost">About</Button>
          <Button variant="default">Get Started</Button>
        </nav>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};