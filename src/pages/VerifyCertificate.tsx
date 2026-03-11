import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CertData {
  certificate_id: string;
  full_name: string;
  completed_at: string;
}

const VerifyCertificate = () => {
  const { certId } = useParams<{ certId: string }>();
  const [cert, setCert] = useState<CertData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certId) return;

    supabase
      .from("certificates")
      .select("certificate_id, full_name, completed_at")
      .eq("certificate_id", certId)
      .single()
      .then(({ data }) => {
        if (data) setCert(data);
        else setNotFound(true);
        setLoading(false);
      });
  }, [certId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
        {cert ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
              <h1 className="mb-1 font-display text-xl font-bold">Certificate Verified ✅</h1>
              <p className="mb-4 text-sm text-muted-foreground">This certificate is authentic and valid.</p>

              <div className="rounded-lg border bg-muted/50 p-4 text-left text-sm">
                <div className="mb-2 flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-semibold">{cert.full_name}</span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-muted-foreground">Program</span>
                  <span className="font-semibold">Survive9ja</span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold">
                    {new Date(cert.completed_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificate ID</span>
                  <span className="font-mono text-xs font-semibold">{cert.certificate_id}</span>
                </div>
              </div>

              <Link to="/" className="mt-6 block">
                <Button variant="outline" className="w-full font-display">Learn More About Survive9ja</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="mb-1 font-display text-xl font-bold">Certificate Not Found</h1>
              <p className="mb-4 text-sm text-muted-foreground">
                We couldn't verify this certificate ID. It may be invalid or expired.
              </p>
              <Link to="/">
                <Button variant="outline" className="w-full font-display">Go to Survive9ja</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificate;
