import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardNav from "@/components/DashboardNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, Loader2, Trash2, Eye, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Documents = () => {
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setDocuments(data || []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("tax-documents").upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: doc, error: insertError } = await supabase.from("documents").insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_path: filePath,
          file_size: file.size,
          status: "uploaded",
        }).select().single();

        if (insertError) throw insertError;

        // Auto-analyze
        if (doc) analyzeDocument(doc);
      }
      toast({ title: "Upload successful!", description: "Your documents are being analyzed." });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const analyzeDocument = async (doc: any) => {
    setAnalyzing(doc.id);
    try {
      // Read file content (text-based analysis)
      const { data: fileData } = await supabase.storage.from("tax-documents").download(doc.file_path);
      let content = "";
      if (fileData) {
        if (doc.file_type.includes("text") || doc.file_type.includes("csv")) {
          content = await fileData.text();
        } else {
          content = `[Binary file: ${doc.file_name}, type: ${doc.file_type}, size: ${doc.file_size} bytes. Please analyze based on file metadata and typical content for this document type.]`;
        }
      }

      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: { documentId: doc.id, fileContent: content, fileName: doc.file_name },
      });

      if (error) throw error;
      toast({ title: "Analysis complete!", description: `${doc.file_name} has been analyzed.` });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const deleteDocument = async (doc: any) => {
    await supabase.storage.from("tax-documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    fetchDocuments();
    toast({ title: "Document deleted" });
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground">Upload and analyze your tax documents</p>
          </div>
          <label>
            <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls" onChange={handleUpload} disabled={uploading} />
            <Button asChild className="rounded-full cursor-pointer" style={{ background: "var(--gradient-primary)" }} disabled={uploading}>
              <span>{uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload Documents</>}</span>
            </Button>
          </label>
        </div>

        {documents.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">No documents yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Upload Form 16, salary slips, or investment proofs to get started</p>
              <label>
                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls" onChange={handleUpload} />
                <Button asChild variant="outline" className="cursor-pointer"><span>Choose Files</span></Button>
              </label>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium truncate max-w-[180px]">{doc.file_name}</CardTitle>
                          <CardDescription className="text-xs">{(doc.file_size / 1024).toFixed(1)} KB</CardDescription>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${doc.status === "analyzed" ? "bg-secondary/10 text-secondary" : "bg-accent/10 text-accent"}`}>
                        {doc.status === "analyzed" ? "Analyzed" : "Uploaded"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {doc.extracted_data && (
                      <div className="text-xs text-muted-foreground mb-3 space-y-1">
                        <p><span className="font-medium">Type:</span> {doc.extracted_data.document_type}</p>
                        {doc.extracted_data.gross_salary > 0 && <p><span className="font-medium">Gross Salary:</span> ₹{Number(doc.extracted_data.gross_salary).toLocaleString("en-IN")}</p>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {doc.status !== "analyzed" && (
                        <Button size="sm" variant="outline" onClick={() => analyzeDocument(doc)} disabled={analyzing === doc.id} className="flex-1">
                          {analyzing === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Brain className="h-3 w-3 mr-1" /> Analyze</>}
                        </Button>
                      )}
                      {doc.extracted_data && (
                        <Button size="sm" variant="outline" onClick={() => setViewDoc(doc)} className="flex-1">
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc)} className="text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* View extracted data dialog */}
        <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Extracted Data — {viewDoc?.file_name}</DialogTitle>
            </DialogHeader>
            {viewDoc?.extracted_data && (
              <div className="space-y-3 text-sm">
                {Object.entries(viewDoc.extracted_data).map(([key, val]) => {
                  if (key === "key_findings" && Array.isArray(val)) {
                    return (
                      <div key={key}>
                        <p className="font-medium text-foreground mb-1">Key Findings</p>
                        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                          {(val as string[]).map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-medium text-foreground">{typeof val === "number" ? `₹${val.toLocaleString("en-IN")}` : String(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Documents;
