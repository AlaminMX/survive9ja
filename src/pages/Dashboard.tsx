import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LogOut, BookOpen, Award, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { profile, signOut } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Learner";

  // Placeholder data - will be dynamic when modules are loaded
  const progress: number = 0;
  const totalModules = 16;
  const completedModules = 0;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="font-display text-base font-700 text-primary">
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
          <h1 className="text-2xl font-700">Welcome back, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">Continue your survival training</p>
        </div>

        {/* Progress Card */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-500">Course Progress</span>
              <span className="text-muted-foreground">{completedModules}/{totalModules} modules</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>{progress === 100 ? "Certificate ready!" : "Complete all modules for your certificate"}</span>
              </div>
              <Button size="sm" className="font-display">
                <BookOpen className="mr-1 h-4 w-4" /> Continue <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Module List placeholder */}
        <h2 className="mb-3 text-lg font-600">Your Modules</h2>
        <p className="text-sm text-muted-foreground">
          Your personalized learning path will appear here after enrollment.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
