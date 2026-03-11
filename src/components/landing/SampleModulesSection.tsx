import { FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const modules = [
  { title: "The Naira-Proof Family Budget Plan", desc: "Learn to create a budget that survives inflation and protects your family's essentials.", pillar: "Wealth & Economic Defence" },
  { title: "How to Spot 419 Scams", desc: "Identify the red flags of common scams targeting Nigerians online and offline.", pillar: "Financial Crime Literacy" },
  { title: "Starting a Service Business", desc: "Step-by-step guide to launching a profitable service business with minimal capital.", pillar: "Income & Hustle Scaling" },
  { title: "Your Rights When Police Stop You", desc: "Know exactly what the law says and how to protect yourself during police encounters.", pillar: "Know Your Rights" },
  { title: "Cutting Your Electricity Bill", desc: "Practical tips to reduce power costs and maximize your energy efficiency at home.", pillar: "Operational Resilience" },
  { title: "Basic Emergency First Aid", desc: "Essential first aid skills every Nigerian should know for emergencies.", pillar: "Civic & Community Resilience" },
];

const SampleModulesSection = () => (
  <section className="px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-5xl">
      <h2 className="mb-3 text-center text-2xl font-700 md:text-3xl">Sample Modules</h2>
      <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
        Here's a taste of what you'll learn inside the program.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, i) => (
          <Card key={i} className="group border shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-secondary" />
                <span className="text-[10px] font-500 uppercase tracking-wider text-secondary">{m.pillar}</span>
              </div>
              <h3 className="mb-2 text-sm font-600 leading-snug">{m.title}</h3>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:text-primary/80">
                Preview Module <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default SampleModulesSection;
