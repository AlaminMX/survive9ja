import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const testimonials = [
  { quote: "I avoided a scam after taking the course. The 419 module literally saved me ₦500,000.", name: "Chinedu A.", location: "Lagos" },
  { quote: "I finally understood my tenant rights. My landlord tried to cheat me and I knew exactly what to do.", name: "Blessing O.", location: "Abuja" },
  { quote: "I started a small freelancing business using what I learned. Now I earn extra income every month.", name: "Tunde M.", location: "Ibadan" },
];

const TestimonialsSection = () => (
  <section className="px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-4xl">
      <h2 className="mb-10 text-center text-2xl font-700 md:text-3xl">Real Stories from Nigerians</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Card key={i} className="border-none bg-green-light shadow-none">
            <CardContent className="p-5">
              <Quote className="mb-3 h-5 w-5 text-primary/40" />
              <p className="mb-4 text-sm leading-relaxed italic">"{t.quote}"</p>
              <div>
                <p className="text-sm font-600">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
