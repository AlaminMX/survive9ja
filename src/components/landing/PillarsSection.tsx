import { Wallet, ShieldAlert, Briefcase, Scale, Wrench, HeartHandshake, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const pillars = [
  { icon: Wallet, title: "Wealth & Economic Defence", desc: "Budgeting, saving, tax basics, inflation protection" },
  { icon: ShieldAlert, title: "Financial Crime Literacy", desc: "Scam detection, digital fraud, banking protection" },
  { icon: Briefcase, title: "Income & Hustle Scaling", desc: "Freelancing, business setup, side hustles" },
  { icon: Scale, title: "Know Your Rights", desc: "Police interaction, tenancy rights, consumer rights" },
  { icon: Wrench, title: "Operational Resilience", desc: "Fuel economy, electricity savings, home maintenance" },
  { icon: HeartHandshake, title: "Civic & Community Resilience", desc: "Disaster preparedness, civic duties, community safety" },
  { icon: Sparkles, title: "She Survives", desc: "Women's financial empowerment and protection" },
];

const PillarsSection = () => (
  <section className="bg-muted px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-5xl">
      <h2 className="mb-3 text-center text-2xl font-700 md:text-3xl">The 7 Survival Pillars</h2>
      <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
        Comprehensive modules covering every aspect of thriving in Nigeria.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p, i) => (
          <Card key={i} className="border-none shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-light">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 text-sm font-600">{p.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default PillarsSection;
