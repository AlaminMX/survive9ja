import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import PillarsSection from "@/components/landing/PillarsSection";
import SampleModulesSection from "@/components/landing/SampleModulesSection";
import PricingSection from "@/components/landing/PricingSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FAQSection from "@/components/landing/FAQSection";
import NewsletterSection from "@/components/landing/NewsletterSection";
import Footer from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      <HeroSection />
      <HowItWorksSection />
      <PillarsSection />
      <SampleModulesSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <NewsletterSection />
    </main>
    <Footer />
  </div>
);

export default Index;
