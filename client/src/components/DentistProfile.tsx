import { useReducer, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Save, UserCircle, Pencil, BadgeCheck } from "lucide-react";

// ---- Types ----
interface FormData {
  name: string;
  croNumber: string;
}

type State = {
  mode: "view" | "editing" | "saving";
  formData: FormData;
  initialData: FormData;
};

type Action =
  | { type: "LOAD_PROFILE"; data: FormData }
  | { type: "START_EDITING" }
  | { type: "UPDATE_FIELD"; field: keyof FormData; value: string }
  | { type: "START_SAVING" }
  | { type: "SAVE_SUCCESS"; data: FormData }
  | { type: "SAVE_ERROR" }
  | { type: "CANCEL" };

const emptyForm: FormData = { name: "", croNumber: "" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_PROFILE":
      // Only update form data if we are NOT editing or saving
      if (state.mode === "editing" || state.mode === "saving") return state;
      return { ...state, formData: action.data, initialData: action.data };
    case "START_EDITING":
      return { ...state, mode: "editing", initialData: { ...state.formData } };
    case "UPDATE_FIELD":
      if (state.mode !== "editing") return state;
      return { ...state, formData: { ...state.formData, [action.field]: action.value } };
    case "START_SAVING":
      return { ...state, mode: "saving" };
    case "SAVE_SUCCESS":
      return { mode: "view", formData: action.data, initialData: action.data };
    case "SAVE_ERROR":
      return { ...state, mode: "editing" };
    case "CANCEL":
      return { mode: "view", formData: state.initialData, initialData: state.initialData };
    default:
      return state;
  }
}

// ---- CRO mask helper ----
function formatCRO(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
  const letters = cleaned.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
  const digits = cleaned.replace(/[^0-9]/g, "").slice(0, 6);
  if (!letters && !digits) return "";
  if (letters && !digits) return `CRO-${letters}`;
  if (!letters && digits) return digits;
  return `CRO-${letters} ${digits}`;
}

export default function DentistProfile() {
  const [state, dispatch] = useReducer(reducer, {
    mode: "view",
    formData: emptyForm,
    initialData: emptyForm,
  });

  const hasLoadedRef = useRef(false);

  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: !hasLoadedRef.current,
  });

  const utils = trpc.useUtils();

  useEffect(() => {
    if (profile) {
      hasLoadedRef.current = true;
      dispatch({
        type: "LOAD_PROFILE",
        data: {
          name: profile.name || "",
          croNumber: profile.croNumber || "",
        },
      });
    }
  }, [profile]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      dispatch({ type: "SAVE_SUCCESS", data: state.formData });
      utils.auth.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar perfil");
      dispatch({ type: "SAVE_ERROR" });
    },
  });

  const handleStartEditing = useCallback(() => {
    dispatch({ type: "START_EDITING" });
  }, []);

  const handleCancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, []);

  const handleFieldChange = useCallback((field: keyof FormData, value: string) => {
    dispatch({ type: "UPDATE_FIELD", field, value });
  }, []);

  const handleCROChange = useCallback((rawValue: string) => {
    dispatch({ type: "UPDATE_FIELD", field: "croNumber", value: formatCRO(rawValue) });
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!state.formData.name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!state.formData.croNumber.trim()) {
      toast.error("CRO é obrigatório");
      return;
    }

    dispatch({ type: "START_SAVING" });
    updateProfileMutation.mutate(state.formData);
  }, [state.formData, updateProfileMutation]);

  const isEditing = state.mode === "editing";
  const isSaving = state.mode === "saving";
  const isDisabled = !isEditing;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Meu Perfil</CardTitle>
            <CardDescription>
              Gerencie suas informações profissionais
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm font-medium flex items-center gap-1.5">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-name"
              type="text"
              placeholder="Dr. João Silva"
              value={state.formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              disabled={isDisabled}
              className={isDisabled ? "bg-muted/50 cursor-not-allowed" : ""}
            />
          </div>

          {/* CRO com máscara */}
          <div className="space-y-2">
            <Label htmlFor="profile-cro" className="text-sm font-medium flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              CRO/Número de Registro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-cro"
              type="text"
              placeholder="CRO-SP 12345"
              value={state.formData.croNumber}
              onChange={(e) => handleCROChange(e.target.value)}
              disabled={isDisabled}
              className={isDisabled ? "bg-muted/50 cursor-not-allowed" : ""}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Formato: CRO-UF Número (ex: CRO-SP 12345)
              </p>
            )}
          </div>

          {/* Editing indicator */}
          {isEditing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Pencil className="h-4 w-4 text-blue-400 shrink-0" />
              <p className="text-sm text-blue-300">
                Modo de edição ativo. Faça suas alterações e clique em <strong>Salvar</strong>.
              </p>
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
              <p className="text-sm text-amber-300">
                Salvando suas alterações...
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            {state.mode === "view" ? (
              <Button
                type="button"
                onClick={handleStartEditing}
                className="w-full"
                variant="default"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar Perfil
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>

          {/* Info Message */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Campos obrigatórios para assinatura no PDF
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
