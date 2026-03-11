import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { toast } from "sonner";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("You're subscribed! Watch your inbox for survival tips.");
    setEmail("");
  };

  return (
    <section className="px-4 py-16 md:py-20">
      <div className="container mx-auto max-w-lg text-center">
        <Mail className="mx-auto mb-4 h-8 w-8 text-primary" />
        <h2 className="mb-2 text-2xl font-700 md:text-3xl">Get Weekly Survival Tips</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Practical advice for navigating Nigeria, delivered to your inbox every week.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 flex-1"
            required
          />
          <Button type="submit" size="lg" className="h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-display font-600 px-6">
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
};

export default NewsletterSection;
