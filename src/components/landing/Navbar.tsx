import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <span className="font-display text-base font-700 text-primary">
          SURVIVE<span className="text-secondary">9JA</span>
        </span>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How It Works</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-display">
            Enroll Now
          </Button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden" aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <a href="#how-it-works" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">How It Works</a>
            <a href="#pricing" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Pricing</a>
            <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display">
              Enroll Now
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
