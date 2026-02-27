import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, DollarSign, Calendar, Scale, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: "employment", title: "Employment Type", description: "What best describes your work?", icon: Briefcase },
  { id: "income", title: "Income Sources", description: "Where does your income come from?", icon: DollarSign },
  { id: "age", title: "Age Group", description: "This affects your tax slabs", icon: Calendar },
  { id: "regime", title: "Tax Regime", description: "Which regime do you prefer?", icon: Scale },
];

const employmentOptions = [
  { value: "salaried", label: "Salaried", desc: "Working for a company" },
  { value: "self-employed", label: "Self-Employed", desc: "Freelancer or consultant" },
  { value: "business", label: "Business Owner", desc: "Running your own business" },
  { value: "retired", label: "Retired", desc: "Pension income" },
];

const incomeOptions = [
  { value: "salary", label: "Salary" },
  { value: "house_property", label: "House Property / Rent" },
  { value: "business", label: "Business / Profession" },
  { value: "capital_gains", label: "Capital Gains" },
  { value: "interest", label: "Interest / Dividends" },
  { value: "freelance", label: "Freelance / Consulting" },
];

const ageOptions = [
  { value: "below-60", label: "Below 60", desc: "General taxpayer" },
  { value: "60-80", label: "60 – 80 years", desc: "Senior citizen" },
  { value: "above-80", label: "Above 80", desc: "Super senior citizen" },
];

const regimeOptions = [
  { value: "new", label: "New Regime", desc: "Lower rates, fewer deductions. Good if you don't have many investments." },
  { value: "old", label: "Old Regime", desc: "Higher rates, but many deductions available (80C, 80D, HRA, etc.)." },
  { value: "unsure", label: "Not Sure", desc: "We'll analyze and recommend the best one for you!" },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [employment, setEmployment] = useState("");
  const [incomeSources, setIncomeSources] = useState<string[]>([]);
  const [ageGroup, setAgeGroup] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const toggleIncome = (v: string) => {
    setIncomeSources((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const canProceed = () => {
    if (step === 0) return !!employment;
    if (step === 1) return incomeSources.length > 0;
    if (step === 2) return !!ageGroup;
    if (step === 3) return !!taxRegime;
    return false;
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase.from("profiles").update({
        employment_type: employment,
        income_sources: incomeSources,
        age_group: ageGroup,
        tax_regime: taxRegime,
        onboarding_completed: true,
      }).eq("user_id", user.id);

      if (error) throw error;

      // Create initial financial data record
      await supabase.from("financial_data").insert({
        user_id: user.id,
        financial_year: "2025-26",
      });

      toast({ title: "Welcome aboard! 🎉", description: "Your profile is set up. Let's start saving on taxes!" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display font-bold text-xl mx-auto mb-4">T</div>
          <h1 className="font-display text-2xl font-bold text-foreground">Let's set up your profile</h1>
          <p className="text-muted-foreground mt-1">Step {step + 1} of {steps.length}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  {(() => { const Icon = steps[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                  {steps[step].title}
                </CardTitle>
                <CardDescription>{steps[step].description}</CardDescription>
              </CardHeader>
              <CardContent>
                {step === 0 && (
                  <div className="grid gap-3">
                    {employmentOptions.map((opt) => (
                      <button key={opt.value} onClick={() => setEmployment(opt.value)}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${employment === opt.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div>
                          <p className="font-medium text-foreground">{opt.label}</p>
                          <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        {employment === opt.value && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    {incomeOptions.map((opt) => (
                      <button key={opt.value} onClick={() => toggleIncome(opt.value)}
                        className={`p-4 rounded-xl border text-left transition-all ${incomeSources.includes(opt.value) ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <p className="font-medium text-sm text-foreground">{opt.label}</p>
                      </button>
                    ))}
                    <p className="col-span-2 text-xs text-muted-foreground mt-1">Select all that apply</p>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-3">
                    {ageOptions.map((opt) => (
                      <button key={opt.value} onClick={() => setAgeGroup(opt.value)}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${ageGroup === opt.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div>
                          <p className="font-medium text-foreground">{opt.label}</p>
                          <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        {ageGroup === opt.value && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-3">
                    {regimeOptions.map((opt) => (
                      <button key={opt.value} onClick={() => setTaxRegime(opt.value)}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${taxRegime === opt.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div>
                          <p className="font-medium text-foreground">{opt.label}</p>
                          <p className="text-sm text-muted-foreground">{opt.desc}</p>
                        </div>
                        {taxRegime === opt.value && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  {step < 3 ? (
                    <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="rounded-full px-6" style={{ background: "var(--gradient-primary)" }}>
                      Next <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={handleFinish} disabled={!canProceed() || loading} className="rounded-full px-6" style={{ background: "var(--gradient-primary)" }}>
                      {loading ? "Setting up..." : "Finish Setup"} <CheckCircle2 className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
