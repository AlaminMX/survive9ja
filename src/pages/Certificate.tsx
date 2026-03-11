import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface CertData {
  certificate_id: string;
  full_name: string;
  completed_at: string;
}

const Certificate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Check if certificate already exists
      const { data: existing } = await supabase
        .from("certificates")
        .select("certificate_id, full_name, completed_at")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        setCert(existing);
        setLoading(false);
        return;
      }

      // Check if all modules are completed
      const [modulesRes, progressRes, profileRes] = await Promise.all([
        supabase.from("modules").select("id"),
        supabase.from("user_module_progress").select("module_id").eq("user_id", user.id).eq("completed", true),
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
      ]);

      const totalModules = modulesRes.data?.length ?? 0;
      const completedModules = progressRes.data?.length ?? 0;

      if (totalModules === 0 || completedModules < totalModules) {
        navigate("/dashboard");
        return;
      }

      // Generate certificate
      const { data: newCert, error } = await supabase
        .from("certificates")
        .insert({
          user_id: user.id,
          full_name: profileRes.data?.full_name || "Learner",
          completed_at: new Date().toISOString(),
        })
        .select("certificate_id, full_name, completed_at")
        .single();

      if (error || !newCert) {
        toast.error("Failed to generate certificate");
        navigate("/dashboard");
        return;
      }

      setCert(newCert);
      setLoading(false);
    };

    load();
  }, [user]);

  const verifyUrl = cert ? `${window.location.origin}/verify/${cert.certificate_id}` : "";

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const text = `I just earned my Certificate of Survival from Survive9ja! 🇳🇬🎓 Verify: ${verifyUrl}`;
    if (navigator.share) {
      await navigator.share({ title: "Certificate of Survival", text, url: verifyUrl });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!cert) return null;

  const completedDate = new Date(cert.completed_at).toLocaleDateString("en-NG", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background print:hidden">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="mr-1 h-4 w-4" /> Share</Button>
            <Button size="sm" onClick={handlePrint}><Download className="mr-1 h-4 w-4" /> Download</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto flex max-w-2xl items-center justify-center px-4 py-8 print:py-0">
        <div className="w-full rounded-xl border-4 border-secondary bg-background p-8 text-center shadow-lg sm:p-12 print:border-2 print:shadow-none">
          {/* Gold seal */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-secondary bg-secondary/10">
            <svg viewBox="0 0 48 48" className="h-10 w-10">
              <path d="M24 4l4.5 9.5L39 15l-7.5 7 2 10.5L24 27.5 14.5 32.5l2-10.5L9 15l10.5-1.5z" fill="hsl(42, 62%, 55%)" />
            </svg>
          </div>

          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">This certifies that</p>

          <h1 className="mb-2 font-display text-3xl font-bold text-foreground sm:text-4xl">{cert.full_name}</h1>

          <p className="mb-6 text-sm text-muted-foreground">
            has successfully completed the <strong className="text-foreground">Survive9ja Program</strong> and is hereby awarded the
          </p>

          <h2 className="mb-1 font-display text-xl font-bold text-primary sm:text-2xl">Certificate of Survival</h2>

          <p className="mb-8 text-xs text-muted-foreground">Completed on {completedDate}</p>

          {/* QR Code */}
          <div className="mx-auto mb-4 inline-block rounded-lg border bg-background p-3">
            <QRCodeSVG value={verifyUrl} size={96} level="M" />
          </div>

          <p className="text-xs text-muted-foreground">
            Certificate ID: <span className="font-mono font-semibold">{cert.certificate_id}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify at <span className="font-mono">{verifyUrl}</span>
          </p>

          <div className="mt-8 border-t pt-4">
            <p className="font-display text-sm font-bold text-primary">
              SURVIVE<span className="text-secondary">9JA</span>
            </p>
            <p className="text-xs text-muted-foreground">Your survival starts here 🇳🇬</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certificate;
