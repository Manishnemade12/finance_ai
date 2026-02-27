import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { IndianRupee, TrendingDown, TrendingUp, CheckCircle2, FileText } from "lucide-react";

const COLORS = ["hsl(250, 85%, 60%)", "hsl(170, 70%, 45%)", "hsl(38, 95%, 55%)", "hsl(280, 80%, 55%)", "hsl(200, 80%, 50%)", "hsl(0, 75%, 55%)"];

const TaxSummary = () => {
  const { user, loading: authLoading } = useAuth();
  const [financialData, setFinancialData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    if (user) {
      supabase.from("financial_data").select("*").eq("financial_year", "2025-26").single().then(({ data }: any) => setFinancialData(data));
      supabase.from("tax_analyses").select("*").eq("financial_year", "2025-26").single().then(({ data }: any) => setAnalysis(data));
    }
  }, [user]);

  if (authLoading) return null;

  const totalIncome = financialData ? Number(financialData.gross_salary || 0) + Number(financialData.other_income || 0) + Number(financialData.rental_income || 0) + Number(financialData.interest_income || 0) + Number(financialData.business_income || 0) : 0;

  const totalDeductions = financialData ? Number(financialData.deductions_80c || 0) + Number(financialData.deductions_80d || 0) + Number(financialData.deductions_80e || 0) + Number(financialData.deductions_80g || 0) + Number(financialData.deductions_nps || 0) + Number(financialData.deductions_hra || 0) + Number(financialData.deductions_lta || 0) + Number(financialData.other_deductions || 0) : 0;

  const incomeData = financialData ? [
    { name: "Salary", value: Number(financialData.gross_salary || 0) },
    { name: "Rental", value: Number(financialData.rental_income || 0) },
    { name: "Interest", value: Number(financialData.interest_income || 0) },
    { name: "Business", value: Number(financialData.business_income || 0) },
    { name: "Other", value: Number(financialData.other_income || 0) },
  ].filter(d => d.value > 0) : [];

  const deductionData = financialData ? [
    { name: "80C", value: Number(financialData.deductions_80c || 0) },
    { name: "80D", value: Number(financialData.deductions_80d || 0) },
    { name: "NPS", value: Number(financialData.deductions_nps || 0) },
    { name: "HRA", value: Number(financialData.deductions_hra || 0) },
    { name: "80E", value: Number(financialData.deductions_80e || 0) },
    { name: "Other", value: Number(financialData.other_deductions || 0) },
  ].filter(d => d.value > 0) : [];

  const regimeData = analysis ? [
    { name: "Old Regime", tax: Number(analysis.old_regime_tax || 0) },
    { name: "New Regime", tax: Number(analysis.new_regime_tax || 0) },
  ] : [];

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" /> Tax Summary Report
          </h1>
          <p className="text-muted-foreground">FY 2025-26 — Consolidated view</p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            { label: "Total Income", value: fmt(totalIncome), icon: TrendingUp, color: "text-secondary" },
            { label: "Total Deductions", value: fmt(totalDeductions), icon: TrendingDown, color: "text-primary" },
            { label: "Old Regime Tax", value: analysis ? fmt(Number(analysis.old_regime_tax || 0)) : "—", icon: IndianRupee, color: "text-accent" },
            { label: "New Regime Tax", value: analysis ? fmt(Number(analysis.new_regime_tax || 0)) : "—", icon: IndianRupee, color: "text-accent" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                  <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          {incomeData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Income Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={incomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${fmt(value)}`}>
                      {incomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {deductionData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-lg">Deductions Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={deductionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="hsl(250, 85%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Regime Comparison */}
        {regimeData.length > 0 && (
          <Card className="mb-8">
            <CardHeader><CardTitle className="font-display text-lg">Old vs New Regime Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={regimeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={100} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="tax" radius={[0, 4, 4, 0]}>
                    {regimeData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {analysis?.recommended_regime && (
                <div className="mt-4 flex items-center gap-2 text-sm text-primary font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Recommended: {analysis.recommended_regime === "old" ? "Old" : "New"} Regime
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Summary */}
        {analysis?.analysis_summary && (
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">AI Analysis Summary</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground leading-relaxed">{analysis.analysis_summary}</p></CardContent>
          </Card>
        )}

        {!analysis && !financialData && (
          <Card className="border-dashed border-2">
            <CardContent className="text-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold mb-1">No data yet</h3>
              <p className="text-muted-foreground text-sm">Go to Tax Analysis to enter your financial data and run an analysis.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TaxSummary;
