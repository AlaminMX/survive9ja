import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const AdminSubscribers = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("newsletter_subscribers").select("*").order("subscribed_at", { ascending: false }).then(({ data }) => {
      setSubs(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 font-display text-xl font-bold">Newsletter Subscribers</h1>
      <Card>
        <CardHeader><CardTitle className="text-sm">All Subscribers ({subs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Subscribed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.subscribed_at), "dd MMM yyyy")}</TableCell>
                </TableRow>
              ))}
              {subs.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No subscribers yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscribers;
