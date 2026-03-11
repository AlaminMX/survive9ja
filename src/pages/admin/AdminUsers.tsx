import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  enrolled: boolean;
  completed_modules: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profilesRes, enrollmentsRes, progressRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("enrollments").select("user_id").eq("payment_status", "completed"),
        supabase.from("user_module_progress").select("user_id, completed").eq("completed", true),
      ]);

      const enrolledSet = new Set((enrollmentsRes.data || []).map((e) => e.user_id));
      const progressMap = new Map<string, number>();
      (progressRes.data || []).forEach((p) => {
        progressMap.set(p.user_id, (progressMap.get(p.user_id) || 0) + 1);
      });

      const rows: UserRow[] = (profilesRes.data || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        created_at: p.created_at,
        enrolled: enrolledSet.has(p.user_id),
        completed_modules: progressMap.get(p.user_id) || 0,
      }));

      setUsers(rows);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 font-display text-xl font-bold">User Management</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.enrolled ? "default" : "secondary"}>
                      {u.enrolled ? "Enrolled" : "Free"}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.completed_modules}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(u.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
