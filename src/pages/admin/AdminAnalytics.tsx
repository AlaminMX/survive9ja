import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, BookOpen, Award } from "lucide-react";

const AdminAnalytics = () => {
  const [stats, setStats] = useState({ users: 0, enrollments: 0, revenue: 0, certificates: 0, completionRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profiles, enrollments, certificates, modules, progress] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("amount_paid").eq("payment_status", "completed"),
        supabase.from("certificates").select("id", { count: "exact", head: true }),
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("user_module_progress").select("completed").eq("completed", true),
      ]);

      const totalUsers = profiles.count || 0;
      const totalEnrollments = enrollments.data?.length || 0;
      const revenue = enrollments.data?.reduce((sum, e) => sum + e.amount_paid, 0) || 0;
      const totalCerts = certificates.count || 0;
      const totalModules = modules.count || 1;
      const completedModules = progress.data?.length || 0;
      const completionRate = totalEnrollments > 0 ? Math.round((completedModules / (totalEnrollments * totalModules)) * 100) : 0;

      setStats({ users: totalUsers, enrollments: totalEnrollments, revenue, certificates: totalCerts, completionRate: Math.min(completionRate, 100) });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-primary" },
    { label: "Enrollments", value: stats.enrollments, icon: CreditCard, color: "text-secondary" },
    { label: "Revenue (₦)", value: `₦${stats.revenue.toLocaleString()}`, icon: CreditCard, color: "text-primary" },
    { label: "Certificates", value: stats.certificates, icon: Award, color: "text-secondary" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 font-display text-xl font-bold">Dashboard Analytics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Average Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-primary">{stats.completionRate}%</div>
            <div className="flex-1">
              <div className="h-3 rounded-full bg-muted">
                <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${stats.completionRate}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
