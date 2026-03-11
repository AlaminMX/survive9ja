import { UserPlus, ClipboardList, Route, Award } from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Sign Up & Pay ₦300", desc: "Create your account and make a one-time payment" },
  { icon: ClipboardList, title: "Answer Questionnaire", desc: "Tell us about yourself so we personalize your path" },
  { icon: Route, title: "Get Your Learning Path", desc: "Receive 15 modules tailored to your situation" },
  { icon: Award, title: "Earn Your Certificate", desc: "Complete all modules and get your Certificate of Survival" },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="px-4 py-16 md:py-20">
    <div className="container mx-auto max-w-4xl">
      <h2 className="mb-12 text-center text-2xl font-700 md:text-3xl">How the Program Works</h2>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div key={i} className="relative text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-light">
              <step.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="mb-1 text-xs font-600 uppercase tracking-wider text-secondary">Step {i + 1}</div>
            <h3 className="mb-1 text-base font-600">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
