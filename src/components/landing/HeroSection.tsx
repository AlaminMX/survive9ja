import { Button } from "@/components/ui/button";
import CertificateBadge from "./CertificateBadge";
import { Shield, Users, BookOpen } from "lucide-react";

const HeroSection = () => (
  <section className="relative overflow-hidden bg-primary px-4 pb-16 pt-20 md:pb-24 md:pt-28">
    {/* Subtle pattern overlay */}
    <div className="absolute inset-0 opacity-[0.04]" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
    }} />

    <div className="container relative mx-auto max-w-4xl text-center">
      <div className="mx-auto mb-6 w-20 md:w-24">
        <CertificateBadge className="w-full h-full" />
      </div>

      <h1 className="mb-4 text-3xl font-800 leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
        The Practical Guide to{" "}
        <span className="text-gold">Surviving Nigeria</span>
      </h1>

      <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-primary-foreground/80 md:text-lg">
        A national resilience program helping Nigerians protect their money, rights, income, and daily life.
      </p>

      <div className="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display font-600 text-base h-12 px-8 sm:w-auto">
          Start Learning for ₦300
        </Button>
        <Button size="lg" variant="outline" className="w-full border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-12 px-8 sm:w-auto">
          See How It Works
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
        <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Trusted Program</span>
        <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> For All Nigerians</span>
        <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> 15+ Modules</span>
      </div>
    </div>
  </section>
);

export default HeroSection;
