import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, CreditCard, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Payment = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"confirm" | "processing" | "success">("confirm");

  const handlePayment = async () => {
    if (!user) return;
    setLoading(true);
    setStep("processing");

    // Simulate Paystack payment delay
    await new Promise((r) => setTimeout(r, 2500));

    // Create enrollment record
    const { error } = await supabase.from("enrollments").insert({
      user_id: user.id,
      amount_paid: 300,
      payment_status: "completed",
      payment_reference: `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    });

    if (error) {
      toast.error("Payment recorded but enrollment failed. Contact support.");
      setStep("confirm");
      setLoading(false);
      return;
    }

    setStep("success");
    setLoading(false);
    toast.success("Enrollment successful!");
  };

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link to="/" className="font-display text-base font-bold text-primary">
            SURVIVE<span className="text-secondary">9JA</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto flex max-w-md items-center justify-center px-4 py-12">
        {step === "confirm" && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-7 w-7 text-primary" />
                </div>
                <h1 className="font-display text-xl font-bold">Complete Your Enrollment</h1>
                <p className="mt-1 text-sm text-muted-foreground">One-time payment for lifetime access</p>
              </div>

              <div className="mb-6 rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Survive9ja Starter Kit</span>
                  <span className="font-display text-lg font-bold text-primary">₦300</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-primary" /> 16 survival modules</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-primary" /> Downloadable guides & checklists</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-primary" /> Certificate of Survival</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-primary" /> Lifetime access</li>
                </ul>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-md bg-green-light p-2.5 text-xs text-primary">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Secured by Paystack. Your payment information is safe.</span>
              </div>

              <Button onClick={handlePayment} className="w-full font-display" size="lg">
                Pay ₦300 Now
              </Button>

              <Link to="/dashboard" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 inline h-3 w-3" /> Back to dashboard
              </Link>
            </CardContent>
          </Card>
        )}

        {step === "processing" && (
          <Card>
            <CardContent className="flex flex-col items-center p-10 text-center">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
              <h2 className="font-display text-lg font-bold">Processing Payment...</h2>
              <p className="mt-1 text-sm text-muted-foreground">Please wait while we confirm your payment</p>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center p-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold">You're In! 🎉</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Welcome aboard, {profile?.full_name?.split(" ")[0]}! Your survival training starts now.
              </p>
              <Button onClick={() => navigate("/dashboard")} className="mt-6 w-full font-display" size="lg">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Payment;
