import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LogOut, BookOpen, Award, ArrowRight, CheckCircle, Circle, Lock, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MobileTabBar from "@/components/MobileTabBar";

interface Pillar {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  pillar_id: string;
  sort_order: number;
}

interface ModuleProgress {
  module_id: string;
  completed: boolean;
}

const Dashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "Learner";

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<ModuleProgress[]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [pillarsRes, modulesRes, progressRes, enrollRes] = await Promise.all([
        supabase.from("pillars").select("*").order("sort_order"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("user_module_progress").select("module_id, completed").eq("user_id", user.id),
        supabase.from("enrollments").select("id").eq("user_id", user.id).eq("payment_status", "completed").limit(1),
      ]);

      setPillars(pillarsRes.data || []);
      setModules(modulesRes.data || []);
      setProgress(progressRes.data || []);
      setEnrolled((enrollRes.data?.length ?? 0) > 0);
      setLoading(false);
    };

    load();
  }, [user]);

  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.module_id));
  const completedCount = completedIds.size;
  const totalModules = modules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const allComplete = totalModules > 0 && completedCount === totalModules;

  const nextModule = modules.find((m) => !completedIds.has(m.id));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="font-display text-base font-bold text-primary">
            SURVIVE<span className="text-secondary">9JA</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="mr-1 h-4 w-4" /> Log out
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Welcome back, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">Continue your survival training</p>
        </div>

        {/* Not enrolled */}
        {!enrolled && (
          <Card className="mb-6 border-secondary/30 bg-secondary/5">
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display font-semibold">You haven't enrolled yet</p>
                  <p className="text-sm text-muted-foreground">Pay ₦300 to unlock all 16 modules and earn your certificate.</p>
                </div>
                <Button onClick={() => navigate("/payment")} className="shrink-0 font-display">
                  Enroll Now — ₦300
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Card */}
        {enrolled && (
          <Card className="mb-6">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Course Progress</span>
                <span className="text-muted-foreground">{completedCount}/{totalModules} modules</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>{allComplete ? "Certificate ready!" : "Complete all modules for your certificate"}</span>
                </div>
                {allComplete ? (
                  <Link to="/certificate">
                    <Button size="sm" className="font-display">
                      <Award className="mr-1 h-4 w-4" /> View Certificate
                    </Button>
                  </Link>
                ) : nextModule ? (
                  <Link to={`/module/${nextModule.id}`}>
                    <Button size="sm" className="font-display">
                      <BookOpen className="mr-1 h-4 w-4" /> Continue <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Module List */}
        <h2 className="mb-3 font-display text-lg font-semibold">Your Modules</h2>

        <div className="space-y-4">
          {pillars.map((pillar) => {
            const pillarModules = modules.filter((m) => m.pillar_id === pillar.id);
            if (pillarModules.length === 0) return null;

            return (
              <div key={pillar.id}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {pillar.title}
                </p>
                <div className="overflow-hidden rounded-lg border bg-background">
                  {pillarModules.map((mod, i) => {
                    const done = completedIds.has(mod.id);
                    const isLocked = !enrolled;

                    return (
                      <Link
                        key={mod.id}
                        to={isLocked ? "#" : `/module/${mod.id}`}
                        className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                          i > 0 ? "border-t" : ""
                        } ${isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50"}`}
                        onClick={(e) => isLocked && e.preventDefault()}
                      >
                        {isLocked ? (
                          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : done ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
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
    </div>
  );
};

export default Dashboard;
