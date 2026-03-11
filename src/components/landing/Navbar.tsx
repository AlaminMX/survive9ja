import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="font-display text-base font-700 text-primary">
          SURVIVE<span className="text-secondary">9JA</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How It Works</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          {session ? (
            <Link to="/dashboard">
              <Button size="sm" className="font-display">Dashboard</Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button size="sm" variant="ghost" className="font-display">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="font-display">Enroll Now</Button>
              </Link>
            </div>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden" aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <a href="#how-it-works" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">How It Works</a>
            <a href="#pricing" onClick={() => setOpen(false)} className="text-sm text-muted-foreground">Pricing</a>
            {session ? (
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full font-display">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}>
                  <Button size="sm" variant="outline" className="w-full font-display">Log In</Button>
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)}>
                  <Button size="sm" className="w-full font-display">Enroll Now</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
