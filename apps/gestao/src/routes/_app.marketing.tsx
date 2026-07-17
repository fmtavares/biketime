import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";

export const Route = createFileRoute("/_app/marketing")({ component: MarketingPage });

const BUCKET = "marketing-uploads";

async function uploadImage(file: File, userId: string, kind: "bike" | "template"): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}-${kind}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function MarketingPage() {
  const [bikeName, setBikeName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [bikeFile, setBikeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bikeFile) {
      toast.error("Envie a foto da bike.");
      return;
    }
    setLoading(true);
    setResult(null);
    setStatusMsg("Enviando imagens...");
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw new Error("Sessão expirada.");
      const userId = userRes.user.id;

      const bikePhoto = await uploadImage(bikeFile, userId, "bike");

      // Carrega o template fixo do /public e converte em File para subir no Storage,
      // garantindo uma URL pública acessível pela OpenAI.
      const tplResp = await fetch("/marketing-template.png");
      if (!tplResp.ok) throw new Error("Falha ao carregar template padrão.");
      const tplBlob = await tplResp.blob();
      const tplFile = new File([tplBlob], "marketing-template.png", {
        type: tplBlob.type || "image/png",
      });
      const templatePhoto = await uploadImage(tplFile, userId, "template");

      setStatusMsg("Iniciando geração...");
      const { data, error } = await supabase.functions.invoke("marketing-generate", {
        body: { bikeName, slogan, description, price, bikePhoto, templatePhoto },
      });
      if (error) throw error;
      const jobId = data?.jobId as string | undefined;
      if (!jobId) throw new Error(data?.error ?? "Falha ao iniciar a geração.");

      setStatusMsg("Gerando campanha...");
      const start = Date.now();
      while (Date.now() - start < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 4000));
        const { data: pollData, error: pollErr } = await supabase.functions.invoke(
          "marketing-generate",
          { body: { poll: jobId } },
        );
        if (pollErr) throw pollErr;
        const status = pollData?.status as string | undefined;
        if (status === "done" && pollData?.image) {
          setResult(pollData.image as string);
          toast.success("Campanha gerada!");
          return;
        }
        if (status === "error") {
          throw new Error((pollData?.error as string) ?? "Erro ao gerar campanha");
        }
      }
      throw new Error("Tempo esgotado aguardando a geração.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar campanha");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Marketing"
        description="Gere campanhas de marketing para bikes usando IA."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Dados da campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bikeName">Nome da bike</Label>
                <Input id="bikeName" value={bikeName} onChange={(e) => setBikeName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slogan">Slogan da campanha</Label>
                <Input id="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Valor</Label>
                <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$ 0,00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição da bike</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bikeFile">Foto da bike</Label>
                <Input id="bikeFile" type="file" accept="image/*" onChange={(e) => setBikeFile(e.target.files?.[0] ?? null)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {statusMsg || "Gerando..."}</>) : (<><Sparkles className="mr-2 h-4 w-4" /> Gerar campanha</>)}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
          <CardContent>
            {loading && (
              <div className="flex h-80 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {statusMsg || "Criando sua campanha..."}
              </div>
            )}
            {!loading && !result && (
              <div className="flex h-80 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                A imagem da campanha aparecerá aqui.
              </div>
            )}
            {result && (
              <div className="space-y-3">
                <img src={result} alt="Campanha gerada" className="w-full rounded-md border" />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const resp = await fetch(result);
                      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `campanha-${bikeName || "bike"}.png`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error(err);
                      toast.error("Não foi possível baixar a imagem.");
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Baixar imagem
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
