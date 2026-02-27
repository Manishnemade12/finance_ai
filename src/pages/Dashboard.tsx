import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Upload, Brain, Landmark, FileText, IndianRupee, TrendingUp, ArrowRight } from "lucide-react";

const COLORS = ["hsl(250, 85%, 60%)", "hsl(170, 70%, 45%)", "hsl(38, 95%, 55%)", "hsl(280, 80%, 55%)"];

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const [stats, setStats] = useState({ documents: 0, totalIncome: 0, estimatedTax: 0, savings: 0 });
  const [incomeData, setIncomeData] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    const [docsRes, finRes, analysisRes] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("financial_data").select("*").eq("financial_year", "2025-26").single(),
      supabase.from("tax_analyses").select("*").eq("financial_year", "2025-26").single(),
    ]);

    const fin = finRes.data;
    const analysis = analysisRes.data;
    const totalIncome = fin ? Number(fin.gross_salary || 0) + Number(fin.other_income || 0) + Number(fin.rental_income || 0) + Number(fin.interest_income || 0) + Number(fin.business_income || 0) : 0;

    const oldTax = analysis ? Number(analysis.old_regime_tax || 0) : 0;
    const newTax = analysis ? Number(analysis.new_regime_tax || 0) : 0;
    const estimatedTax = analysis ? Math.min(oldTax, newTax) : 0;
    const savings = analysis ? Math.abs(oldTax - newTax) : 0;

    setStats({
      documents: docsRes.count || 0,
      totalIncome,
      estimatedTax,
      savings,
    });

    if (fin) {
      setIncomeData([
        { name: "Salary", value: Number(fin.gross_salary || 0) },
        { name: "Rental", value: Number(fin.rental_income || 0) },
        { name: "Interest", value: Number(fin.interest_income || 0) },
        { name: "Other", value: Number(fin.other_income || 0) + Number(fin.business_income || 0) },
      ].filter(d => d.value > 0));
    }
  };

  if (loading) return null;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const quickActions = [
    { label: "Upload Documents", icon: Upload, path: "/documents", color: "bg-primary/10 text-primary" },
    { label: "Run Tax Analysis", icon: Brain, path: "/tax-analysis", color: "bg-secondary/10 text-secondary" },
    { label: "Explore Schemes", icon: Landmark, path: "/schemes", color: "bg-accent/10 text-accent" },
    { label: "View Summary", icon: FileText, path: "/tax-summary", color: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">
            Welcome, {profile?.full_name || user?.user_metadata?.full_name || "there"}! 👋
          </h1>
          <p className="text-muted-foreground text-lg mb-8">Here's your tax overview for FY 2025-26</p>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            { label: "Total Income", value: fmt(stats.totalIncome), icon: TrendingUp, color: "text-secondary" },
            { label: "Estimated Tax", value: fmt(stats.estimatedTax), icon: IndianRupee, color: "text-accent" },
            { label: "Potential Savings", value: fmt(stats.savings), icon: TrendingUp, color: "text-primary" },
            { label: "Documents", value: String(stats.documents), icon: FileText, color: "text-muted-foreground" },
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

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Income Chart */}
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Income Breakdown</CardTitle></CardHeader>
            <CardContent>
              {incomeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={incomeData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name }) => name}>
                      {incomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <p>No income data yet. Go to Tax Analysis to add your details.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.path} to={action.path}>
                  <div className="p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                    <div className={`p-2 rounded-lg ${action.color} inline-block mb-2`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
