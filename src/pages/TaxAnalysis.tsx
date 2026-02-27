import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Brain, Loader2, TrendingDown, TrendingUp, IndianRupee, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const TaxAnalysis = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [financialData, setFinancialData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchFinancialData();
      fetchAnalysis();
    }
  }, [user]);

  const fetchFinancialData = async () => {
    const { data } = await supabase.from("financial_data").select("*").eq("financial_year", "2025-26").single();
    if (data) {
      setFinancialData(data);
    } else if (user) {
      // Create initial financial data if none exists
      const { data: newData } = await supabase.from("financial_data").insert({
        user_id: user.id,
        financial_year: "2025-26",
      }).select().single();
      if (newData) setFinancialData(newData);
    }
  };

  const fetchAnalysis = async () => {
    const { data } = await supabase.from("tax_analyses").select("*").eq("financial_year", "2025-26").single();
    if (data) setAnalysis(data);
  };

  const updateField = (field: string, value: string) => {
    setFinancialData((prev: any) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const saveFinancialData = async () => {
    if (!financialData || !user) return;
    setSaving(true);
    try {
      await supabase.from("financial_data").update(financialData).eq("id", financialData.id);
      toast({ title: "Saved!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runAnalysis = async () => {
    if (!financialData) return;
    setAnalyzing(true);
    try {
      await saveFinancialData();
      const { data, error } = await supabase.functions.invoke("tax-analysis", {
        body: { financialData, profile },
      });
      if (error) throw error;
      setAnalysis(data.data);
      toast({ title: "Analysis complete! 🎉", description: "Check your tax breakdown below." });
      fetchAnalysis();
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  if (authLoading || !financialData) return null;

  const incomeFields = [
    { key: "gross_salary", label: "Gross Salary" },
    { key: "hra_received", label: "HRA Received" },
    { key: "lta_received", label: "LTA Received" },
    { key: "other_income", label: "Other Income" },
    { key: "rental_income", label: "Rental Income" },
    { key: "interest_income", label: "Interest Income" },
    { key: "business_income", label: "Business Income" },
  ];

  const deductionFields = [
    { key: "deductions_80c", label: "Section 80C (PPF, ELSS, LIC etc.)" },
    { key: "deductions_80d", label: "Section 80D (Health Insurance)" },
    { key: "deductions_80e", label: "Section 80E (Education Loan)" },
    { key: "deductions_80g", label: "Section 80G (Donations)" },
    { key: "deductions_nps", label: "NPS (80CCD)" },
    { key: "deductions_hra", label: "HRA Exemption" },
    { key: "deductions_lta", label: "LTA Exemption" },
    { key: "other_deductions", label: "Other Deductions" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Tax Analysis</h1>
            <p className="text-muted-foreground">Enter your financials and get AI-powered tax guidance</p>
          </div>
          <Button onClick={runAnalysis} disabled={analyzing} className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
            {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</> : <><Brain className="h-4 w-4 mr-2" /> Run AI Analysis</>}
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Income inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-secondary" /> Income Details</CardTitle>
              <CardDescription>FY 2025-26</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {incomeFields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" className="pl-7" value={financialData[f.key] || ""} onChange={(e) => updateField(f.key, e.target.value)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Deduction inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5 text-primary" /> Deductions Claimed</CardTitle>
              <CardDescription>Under various sections</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {deductionFields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" className="pl-7" value={financialData[f.key] || ""} onChange={(e) => updateField(f.key, e.target.value)} />
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={saveFinancialData} disabled={saving} className="mt-2">
                {saving ? "Saving..." : "Save Data"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-8">
            {/* Regime Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className={`${(analysis.recommended_regime || analysis.recommended_regime) === "old" ? "ring-2 ring-primary" : ""}`}>
                <CardHeader>
                  <CardTitle className="font-display text-lg">Old Regime</CardTitle>
                  {(analysis.recommended_regime) === "old" && <span className="text-xs text-primary font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Recommended</span>}
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-display font-bold text-foreground">₹{Number(analysis.old_regime_tax || 0).toLocaleString("en-IN")}</p>
                  <p className="text-sm text-muted-foreground mt-1">Estimated tax payable</p>
                </CardContent>
              </Card>
              <Card className={`${(analysis.recommended_regime) === "new" ? "ring-2 ring-primary" : ""}`}>
                <CardHeader>
                  <CardTitle className="font-display text-lg">New Regime</CardTitle>
                  {(analysis.recommended_regime) === "new" && <span className="text-xs text-primary font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Recommended</span>}
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-display font-bold text-foreground">₹{Number(analysis.new_regime_tax || 0).toLocaleString("en-IN")}</p>
                  <p className="text-sm text-muted-foreground mt-1">Estimated tax payable</p>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            {analysis.analysis_summary && (
              <Card>
                <CardHeader><CardTitle className="font-display text-lg">AI Summary</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed">{analysis.analysis_summary}</p></CardContent>
              </Card>
            )}

            {/* Deduction Suggestions */}
            {analysis.deduction_suggestions && analysis.deduction_suggestions.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-bold text-foreground mb-4">💡 Deduction Suggestions</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.deduction_suggestions.map((s: any, i: number) => (
                    <Card key={i} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s.section}</span>
                          <span className="text-xs text-secondary font-medium">Save ₹{Number(s.potential_saving || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <h3 className="font-medium text-foreground mb-1">{s.title}</h3>
                        <p className="text-sm text-muted-foreground">{s.description}</p>
                        {s.max_limit > 0 && <p className="text-xs text-muted-foreground mt-2">Max limit: ₹{Number(s.max_limit).toLocaleString("en-IN")}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TaxAnalysis;
