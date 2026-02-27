import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Landmark, ExternalLink, Brain, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const defaultSchemes = [
  { name: "Public Provident Fund (PPF)", type: "Savings", tax_benefit: "Section 80C – up to ₹1.5L deduction. Interest is tax-free.", eligibility: "Any Indian resident", description: "Government-backed long-term savings scheme with 7.1% interest (15-year lock-in). EEE tax status.", how_to_apply: "Open at any post office or bank" },
  { name: "Equity Linked Savings Scheme (ELSS)", type: "Investment", tax_benefit: "Section 80C – up to ₹1.5L. Shortest lock-in (3 years) among 80C options.", eligibility: "Any Indian resident with PAN", description: "Mutual fund category that invests in equities with potential for high returns and tax savings.", how_to_apply: "Invest via any mutual fund platform or AMC" },
  { name: "National Pension System (NPS)", type: "Retirement", tax_benefit: "80CCD(1): ₹1.5L under 80C. 80CCD(1B): Additional ₹50,000. 80CCD(2): Employer contribution (14% of salary).", eligibility: "Indian citizens aged 18-70", description: "Market-linked retirement savings with partial annuity. One of the best tax-saving instruments.", how_to_apply: "Register at enps.nsdl.com or through banks" },
  { name: "Sukanya Samriddhi Yojana", type: "Savings", tax_benefit: "Section 80C – up to ₹1.5L. Interest and maturity fully tax-free (EEE).", eligibility: "Parents of girl child below 10 years", description: "High-interest savings scheme (8.2%) for the girl child's education and marriage.", how_to_apply: "Open at any post office or authorized bank" },
  { name: "PM Jeevan Jyoti Bima Yojana", type: "Insurance", tax_benefit: "Premium of ₹436/year deductible under 80C.", eligibility: "Age 18–50, bank account holder", description: "Life insurance cover of ₹2 lakh at just ₹436/year through participating banks.", how_to_apply: "Enroll through any bank branch or net banking" },
  { name: "PM Suraksha Bima Yojana", type: "Insurance", tax_benefit: "Premium deductible under 80C.", eligibility: "Age 18–70, bank account holder", description: "Accident insurance cover of ₹2 lakh at just ₹20/year.", how_to_apply: "Enroll through any bank branch or net banking" },
];

const Schemes = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [schemes, setSchemes] = useState<any[]>(defaultSchemes);
  const [aiSchemes, setAiSchemes] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchAiSchemes();
  }, [user]);

  const fetchAiSchemes = async () => {
    const { data } = await supabase.from("tax_analyses").select("scheme_recommendations").eq("financial_year", "2025-26").single();
    if (data?.scheme_recommendations && Array.isArray(data.scheme_recommendations)) setAiSchemes(data.scheme_recommendations as any[]);
  };

  const getPersonalizedSchemes = async () => {
    setLoadingAi(true);
    try {
      const { data: finData } = await supabase.from("financial_data").select("*").eq("financial_year", "2025-26").single();
      const { data, error } = await supabase.functions.invoke("tax-analysis", {
        body: { financialData: finData || {}, profile },
      });
      if (error) throw error;
      if (data?.data?.scheme_recommendations) {
        setAiSchemes(data.data.scheme_recommendations);
        toast({ title: "Personalized recommendations ready! 🎯" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAi(false);
    }
  };

  if (authLoading) return null;

  const allSchemes = aiSchemes.length > 0 ? aiSchemes : schemes;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Government Schemes</h1>
            <p className="text-muted-foreground">Discover tax-saving schemes you're eligible for</p>
          </div>
          <Button onClick={getPersonalizedSchemes} disabled={loadingAi} className="rounded-full" style={{ background: "var(--gradient-primary)" }}>
            {loadingAi ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</> : <><Brain className="h-4 w-4 mr-2" /> Get AI Recommendations</>}
          </Button>
        </div>

        {aiSchemes.length > 0 && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-secondary/10 text-secondary text-sm font-medium inline-flex items-center gap-2">
            <Brain className="h-4 w-4" /> Personalized AI recommendations based on your profile
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allSchemes.map((scheme, i) => (
            <motion.div key={scheme.name + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-primary/10 mb-2">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-xs">{scheme.type}</Badge>
                  </div>
                  <CardTitle className="font-display text-base">{scheme.name}</CardTitle>
                  <CardDescription className="text-xs">{scheme.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-foreground mb-0.5">Tax Benefit</p>
                    <p className="text-xs text-muted-foreground">{scheme.tax_benefit}</p>
                  </div>
                  {scheme.eligibility && (
                    <div>
                      <p className="text-xs font-medium text-foreground mb-0.5">Eligibility</p>
                      <p className="text-xs text-muted-foreground">{scheme.eligibility}</p>
                    </div>
                  )}
                  {scheme.how_to_apply && (
                    <div>
                      <p className="text-xs font-medium text-foreground mb-0.5">How to Apply</p>
                      <p className="text-xs text-muted-foreground">{scheme.how_to_apply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schemes;
