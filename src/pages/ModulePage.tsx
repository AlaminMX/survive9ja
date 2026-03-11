import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CheckCircle, FileText, Download,
  BookOpen, ClipboardList, Image as ImageIcon, Presentation, Loader2, Video,
} from "lucide-react";

interface Module {
  id: string;
  title: string;
  description: string | null;
  pillar_id: string;
  sort_order: number;
  video_url: string | null;
  slide_deck_url: string | null;
  pdf_guide_url: string | null;
  workbook_url: string | null;
  checklist_url: string | null;
  infographic_url: string | null;
}

interface Pillar {
  id: string;
  title: string;
}

const materialConfig = [
  { key: "pdf_guide_url", label: "PDF Guide", icon: FileText },
  { key: "slide_deck_url", label: "Slide Deck", icon: Presentation },
  { key: "workbook_url", label: "Workbook", icon: BookOpen },
  { key: "checklist_url", label: "Checklist", icon: ClipboardList },
  { key: "infographic_url", label: "Infographic", icon: ImageIcon },
] as const;

const ModulePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mod, setMod] = useState<Module | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      setLoading(true);
      const [modRes, allRes, progRes] = await Promise.all([
        supabase.from("modules").select("*").eq("id", id).single(),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("user_module_progress").select("completed").eq("user_id", user.id).eq("module_id", id).single(),
      ]);

      if (!modRes.data) {
        navigate("/dashboard");
        return;
      }

      setMod(modRes.data);
      setAllModules(allRes.data || []);
      setCompleted(progRes.data?.completed ?? false);

      const pillarRes = await supabase.from("pillars").select("id, title").eq("id", modRes.data.pillar_id).single();
      setPillar(pillarRes.data);
      setLoading(false);
    };

    load();
  }, [id, user]);

  const handleMarkComplete = async () => {
    if (!user || !id) return;
    setMarking(true);

    const { data: existing } = await supabase
      .from("user_module_progress")
      .select("id")
      .eq("user_id", user.id)
      .eq("module_id", id)
      .single();

    if (existing) {
      await supabase
        .from("user_module_progress")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_module_progress").insert({
        user_id: user.id,
        module_id: id,
        completed: true,
        completed_at: new Date().toISOString(),
      });
    }

    setCompleted(true);
    setMarking(false);
    toast.success("Module completed! 🎉");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!mod) return null;

  const currentIdx = allModules.findIndex((m) => m.id === id);
  const prevModule = currentIdx > 0 ? allModules[currentIdx - 1] : null;
  const nextModule = currentIdx < allModules.length - 1 ? allModules[currentIdx + 1] : null;

  const materials = materialConfig.filter((m) => mod[m.key]);

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Pillar label */}
        {pillar && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary">{pillar.title}</p>
        )}

        <h1 className="mb-2 font-display text-2xl font-bold">{mod.title}</h1>
        {mod.description && <p className="mb-6 text-sm text-muted-foreground">{mod.description}</p>}

        {/* Video / Slide placeholder */}
        {mod.video_url ? (
          <Card className="mb-6 overflow-hidden">
            <div className="aspect-video bg-foreground/5">
              <iframe
                src={mod.video_url}
                className="h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title={mod.title}
              />
            </div>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Video className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Video content coming soon</p>
              <p className="mt-1 text-xs text-muted-foreground/60">Review the downloadable materials below to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Downloadable materials */}
        {materials.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-base font-semibold">Materials</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {materials.map((mat) => {
                const Icon = mat.icon;
                return (
                  <a
                    key={mat.key}
                    href={mod[mat.key]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 font-medium">{mat.label}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Mark as complete */}
        <div className="mb-8">
          {completed ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-green-light p-4 text-sm font-medium text-primary">
              <CheckCircle className="h-5 w-5" />
              Module completed!
            </div>
          ) : (
            <Button onClick={handleMarkComplete} disabled={marking} className="w-full font-display" size="lg">
              {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Mark as Completed
            </Button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {prevModule ? (
            <Link to={`/module/${prevModule.id}`}>
              <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Previous</Button>
            </Link>
          ) : <div />}
          {nextModule ? (
            <Link to={`/module/${nextModule.id}`}>
              <Button variant="ghost" size="sm">Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          ) : completed ? (
            <Link to="/dashboard">
              <Button size="sm" className="font-display">Back to Dashboard</Button>
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>
  );
};

export default ModulePage;
