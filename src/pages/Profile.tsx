import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Save, FileText } from "lucide-react";

const Profile = () => {
  const { user, profile, loading: authLoading, refetchProfile } = useAuth(false);
  const [fullName, setFullName] = useState("");
  const [employment, setEmployment] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmployment(profile.employment_type || "");
      setAgeGroup(profile.age_group || "");
      setTaxRegime(profile.tax_regime || "");
    }
    if (user) {
      supabase.from("documents").select("id, file_name, status, created_at").order("created_at", { ascending: false }).then(({ data }: any) => setDocuments(data || []));
    }
  }, [profile, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName,
        employment_type: employment,
        age_group: ageGroup,
        tax_regime: taxRegime,
      }).eq("user_id", user.id);
      if (error) throw error;
      refetchProfile();
      toast({ title: "Profile updated! ✅" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-8 flex items-center gap-2">
          <User className="h-8 w-8 text-primary" /> Profile & Settings
        </h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-display text-lg">Personal Details</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={employment} onValueChange={setEmployment}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="self-employed">Self-Employed</SelectItem>
                  <SelectItem value="business">Business Owner</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Age Group</Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="below-60">Below 60</SelectItem>
                  <SelectItem value="60-80">60 – 80</SelectItem>
                  <SelectItem value="above-80">Above 80</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax Regime Preference</Label>
              <Select value={taxRegime} onValueChange={setTaxRegime}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Regime</SelectItem>
                  <SelectItem value="old">Old Regime</SelectItem>
                  <SelectItem value="unsure">Not Sure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Document History</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("en-IN")}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === "analyzed" ? "bg-secondary/10 text-secondary" : "bg-accent/10 text-accent"}`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
