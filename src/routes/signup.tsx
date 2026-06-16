import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { fetchSetores, qk } from "@/lib/checklists-db";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Cadastrar — Misturaria Control" }] }),
  component: SignupPage,
});

const CARGOS = ["Atendente", "Cozinheiro", "Auxiliar de cozinha", "Caixa", "Bartender", "Gerente"];

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { data: setores = [] } = useQuery({
    queryKey: qk.setores,
    queryFn: fetchSetores,
  });
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState<string>("");
  const [setor, setSetor] = useState<string>("");
  const [foto, setFoto] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cargo || !setor) {
      toast.error("Selecione cargo e setor");
      return;
    }
    if (senha.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await signup({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        cargo,
        setor,
      });
      toast.success("Cadastro enviado! Aguarde aprovação do administrador.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Após o cadastro, o administrador precisa aprovar seu acesso.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <label
              htmlFor="foto"
              className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-card text-muted-foreground"
            >
              {foto ? (
                <img src={foto} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </label>
            <input
              id="foto"
              type="file"
              accept="image/*"
              capture="user"
              onChange={onFile}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">Foto opcional (adicionar no perfil)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={cargo} onValueChange={setCargo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={s.nome}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Solicitar acesso"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-primary">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
