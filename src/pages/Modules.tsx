import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BookOpen, Lock, CheckCircle, Circle, ChevronRight } from "lucide-react";
import MobileTabBar from "@/components/MobileTabBar";

const Modules = () => {
  const { user } = useAuth();
  const [pillars, setPillars] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [p, m, pr, e] = await Promise.all([
        supabase.from("pillars").select("*").order("sort_order"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("user_module_progress").select("module_id, completed").eq("user_id", user.id),
        supabase.from("enrollments").select("id").eq("user_id", user.id).eq("payment_status", "completed").limit(1),
      ]);
      setPillars(p.data || []);
      setModules(m.data || []);
      setProgress(pr.data || []);
      setEnrolled((e.data?.length ?? 0) > 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const completedIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.module_id));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted pb-20 md:pb-0">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center px-4">
          <BookOpen className="mr-2 h-5 w-5 text-primary" />
          <h1 className="font-display text-base font-bold">All Modules</h1>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-4">
          {pillars.map((pillar) => {
            const pillarModules = modules.filter((m: any) => m.pillar_id === pillar.id);
            if (!pillarModules.length) return null;
            return (
              <div key={pillar.id}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pillar.title}</p>
                <div className="overflow-hidden rounded-lg border bg-background">
                  {pillarModules.map((mod: any, i: number) => {
                    const done = completedIds.has(mod.id);
                    const isLocked = !enrolled;
                    return (
                      <Link
                        key={mod.id}
                        to={isLocked ? "#" : `/module/${mod.id}`}
                        className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${i > 0 ? "border-t" : ""} ${isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50"}`}
                        onClick={(e) => isLocked && e.preventDefault()}
                      >
                        {isLocked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : done ? <CheckCircle className="h-4 w-4 shrink-0 text-primary" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className={`flex-1 ${done ? "text-muted-foreground" : "font-medium"}`}>{mod.title}</span>
                        {!isLocked && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MobileTabBar />
    </div>
  );
};

export default Modules;
