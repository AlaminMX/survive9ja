import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Award } from "lucide-react";

const features = [
  "15 personalized survival modules",
  "Downloadable guides and checklists",
  "Access to daily survival tips",
  "Certificate of Survival upon completion",
];

const PricingSection = () => (
  <section id="pricing" className="bg-muted px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-md">
      <h2 className="mb-10 text-center text-2xl font-700 md:text-3xl">Simple, Affordable Pricing</h2>
      <Card className="relative overflow-hidden border-2 border-primary shadow-lg">
        <div className="bg-primary px-5 py-3 text-center">
          <span className="text-xs font-600 uppercase tracking-wider text-primary-foreground/80">One-time payment</span>
        </div>
        <CardContent className="p-6 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-secondary" />
          <h3 className="mb-1 text-lg font-700">Starter Kit</h3>
          <div className="mb-5">
            <span className="text-4xl font-800 text-primary">₦300</span>
          </div>
          <ul className="mb-6 space-y-3 text-left text-sm">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display font-600 h-12 text-base">
            Enroll Now
          </Button>
        </CardContent>
      </Card>
    </div>
  </section>
);

export default PricingSection;
