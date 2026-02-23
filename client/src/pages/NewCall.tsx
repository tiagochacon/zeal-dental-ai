import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mic, Square, Upload, Phone } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export default function NewCall() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get query params
  const searchParams = new URLSearchParams(window.location.search);
  const preLeadId = searchParams.get("leadId");
  const preLeadName = searchParams.get("leadName");

  const [leadId, setLeadId] = useState(preLeadId ? parseInt(preLeadId) : 0);
  const [leadName, setLeadName] = useState(preLeadName || "");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const createCall = trpc.calls.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Ligação registrada!");
      setLocation(`/calls/${data.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadAudio = trpc.calls.uploadAudio.useMutation();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSubmit = async () => {
    if (!leadId || !leadName.trim()) {
      toast.error("Selecione um lead");
      return;
    }

    setUploading(true);
    try {
      // Step 1: Create the call record
      const call = await createCall.mutateAsync({
        leadId,
        leadName: leadName.trim(),
      });

      // Step 2: Upload audio if recorded
      if (audioBlob && call.id) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (data:audio/webm;base64,...)
            const base64Data = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64Data);
          };
          reader.readAsDataURL(audioBlob);
        });

        await uploadAudio.mutateAsync({
          callId: call.id,
          audioBase64: base64,
          mimeType: "audio/webm",
          durationSeconds: recordingTime,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar ligação");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const leads = (leadsQuery.data || []).filter((l: any) => !l.isConverted);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center h-16 px-4 gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">Nova Ligação</h1>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-2xl mx-auto">
        {/* Select Lead */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Selecionar Lead</h2>
          
          {preLeadId ? (
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Phone className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-foreground">{leadName}</span>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Nenhum lead ativo. <Link href="/leads" className="text-blue-400">Cadastre um lead primeiro</Link>.
                </p>
              ) : (
                leads.map((lead: any) => (
                  <div
                    key={lead.id}
                    onClick={() => { setLeadId(lead.id); setLeadName(lead.name); }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      leadId === lead.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:border-blue-500/30"
                    }`}
                  >
                    <p className="font-medium text-foreground text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "Sem contato"}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Audio Recording */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Gravação de Áudio</h2>
          
          <div className="flex flex-col items-center gap-4">
            {!audioBlob ? (
              <>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? "bg-red-500/20 border-2 border-red-500 animate-pulse" 
                    : "bg-blue-600/20 border-2 border-blue-500"
                }`}>
                  {isRecording ? (
                    <button onClick={stopRecording} className="w-full h-full flex items-center justify-center">
                      <Square className="h-8 w-8 text-red-400" />
                    </button>
                  ) : (
                    <button onClick={startRecording} className="w-full h-full flex items-center justify-center">
                      <Mic className="h-8 w-8 text-blue-400" />
                    </button>
                  )}
                </div>
                
                {isRecording && (
                  <div className="text-center">
                    <p className="text-2xl font-mono text-red-400">{formatTime(recordingTime)}</p>
                    <p className="text-sm text-muted-foreground">Gravando...</p>
                  </div>
                )}
                
                {!isRecording && (
                  <p className="text-sm text-muted-foreground">Clique para iniciar a gravação</p>
                )}
              </>
            ) : (
              <>
                <audio controls src={audioUrl || undefined} className="w-full" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl(null);
                      setRecordingTime(0);
                    }}
                  >
                    Gravar novamente
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Duração: {formatTime(recordingTime)}</p>
              </>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!leadId || uploading || createCall.isPending}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl"
        >
          {uploading || createCall.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {uploading ? "Enviando áudio..." : "Registrando..."}
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              Registrar Ligação
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-3">
          A gravação será transcrita e analisada automaticamente pela IA
        </p>
      </main>
    </div>
  );
}
