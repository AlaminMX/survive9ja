import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "What do I get for ₦300?", a: "You get access to 15 personalized survival modules, downloadable guides and checklists, daily survival tips, and a Certificate of Survival upon completion. It's a one-time payment — no hidden fees." },
  { q: "How long does the course take?", a: "You can complete the course at your own pace. Most people finish within 2-4 weeks, but you have lifetime access to all materials." },
  { q: "Is the certificate real?", a: "Yes. Your Certificate of Survival comes with a unique ID and QR code that anyone can verify online. It proves you completed the full program." },
  { q: "Can I access it on my phone?", a: "Absolutely. The entire platform is built mobile-first. It works on any smartphone, even on 2G/3G networks." },
  { q: "Who created this program?", a: "Survive Nigeria was created by a team of Nigerian professionals, educators, and community leaders committed to building practical resilience skills across the nation." },
];

const FAQSection = () => (
  <section className="bg-muted px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-2xl">
      <h2 className="mb-10 text-center text-2xl font-700 md:text-3xl">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
            <AccordionTrigger className="text-left text-sm font-500 hover:no-underline">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
