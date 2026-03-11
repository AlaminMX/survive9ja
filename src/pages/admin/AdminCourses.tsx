import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

interface Pillar { id: string; title: string; description: string; icon: string; sort_order: number; }
interface Module { id: string; title: string; description: string | null; pillar_id: string; sort_order: number; video_url: string | null; pdf_guide_url: string | null; }

const AdminCourses = () => {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", pillar_id: "", video_url: "", pdf_guide_url: "" });

  const load = async () => {
    const [p, m] = await Promise.all([
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("modules").select("*").order("sort_order"),
    ]);
    setPillars(p.data || []);
    setModules(m.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditModule(null);
    setForm({ title: "", description: "", pillar_id: pillars[0]?.id || "", video_url: "", pdf_guide_url: "" });
    setModuleDialogOpen(true);
  };

  const openEdit = (mod: Module) => {
    setEditModule(mod);
    setForm({ title: mod.title, description: mod.description || "", pillar_id: mod.pillar_id, video_url: mod.video_url || "", pdf_guide_url: mod.pdf_guide_url || "" });
    setModuleDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.pillar_id) { toast.error("Title and pillar required"); return; }

    const payload = {
      title: form.title,
      description: form.description || null,
      pillar_id: form.pillar_id,
      video_url: form.video_url || null,
      pdf_guide_url: form.pdf_guide_url || null,
    };

    if (editModule) {
      const { error } = await supabase.from("modules").update(payload).eq("id", editModule.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Module updated");
    } else {
      const maxOrder = modules.filter(m => m.pillar_id === form.pillar_id).length;
      const { error } = await supabase.from("modules").insert({ ...payload, sort_order: maxOrder });
      if (error) { toast.error(error.message); return; }
      toast.success("Module created");
    }

    setModuleDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this module?")) return;
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Course Management</h1>
        <Button onClick={openNew} size="sm" className="font-display">
          <Plus className="mr-1 h-4 w-4" /> Add Module
        </Button>
      </div>

      <div className="space-y-4">
        {pillars.map((pillar) => {
          const pillarModules = modules.filter((m) => m.pillar_id === pillar.id);
          return (
            <Card key={pillar.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pillarModules.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">No modules</p>
                ) : (
                  <div className="divide-y">
                    {pillarModules.map((mod) => (
                      <div key={mod.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        <div className="flex-1">
                          <p className="font-medium">{mod.title}</p>
                          {mod.description && <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(mod)} className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(mod.id)} className="h-8 w-8 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editModule ? "Edit Module" : "New Module"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Pillar</Label>
              <Select value={form.pillar_id} onValueChange={(v) => setForm({ ...form, pillar_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pillars.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>PDF Guide URL</Label>
              <Input value={form.pdf_guide_url} onChange={(e) => setForm({ ...form, pdf_guide_url: e.target.value })} placeholder="https://..." />
            </div>
            <Button onClick={handleSave} className="w-full font-display">{editModule ? "Save Changes" : "Create Module"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCourses;
