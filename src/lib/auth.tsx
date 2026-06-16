import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type { User as AppUser, Role, UserStatus } from "./types";
import { logActivity } from "./activity-db";

interface SignupInput {
  nome: string;
  email: string;
  senha: string;
  cargo: string;
  setor: string;
  fotoDataUrl?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<AppUser>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAppUser(session: Session | null): Promise<AppUser | null> {
  if (!session?.user) return null;
  const uid = session.user.id;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
  ]);
  if (!profile) return null;
  const roleList = (roles ?? []).map((r) => r.role as Role);
  const role: Role =
    roleList.find((r) => r === "admin") ??
    roleList.find((r) => r === "gerente") ??
    roleList[0] ??
    "atendimento";
  return {
    id: profile.id,
    nome: profile.nome,
    email: profile.email,
    cargo: profile.cargo ?? "",
    setor: profile.setor ?? "",
    role,
    fotoDataUrl: profile.foto_url ?? undefined,
    status: profile.status as UserStatus,
    createdAt: new Date(profile.created_at).getTime(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setTimeout(async () => {
        const appUser = await loadAppUser(newSession);
        if (mounted) setUser(appUser);
      }, 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      const appUser = await loadAppUser(data.session);
      if (mounted) {
        setUser(appUser);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) throw new Error(traduzErro(error.message));
    const appUser = await loadAppUser(data.session);
    if (!appUser) throw new Error("Perfil não encontrado");
    if (appUser.status === "pending") {
      await supabase.auth.signOut();
      throw new Error("Cadastro aguardando aprovação do administrador");
    }
    if (appUser.status === "rejected") {
      await supabase.auth.signOut();
      throw new Error("Cadastro recusado");
    }
    setUser(appUser);
    logActivity({ tipo: "login", nome: appUser.nome, user_id: appUser.id });
    return appUser;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.senha,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          nome: input.nome,
          cargo: input.cargo,
          setor: input.setor,
          foto_url: input.fotoDataUrl,
        },
      },
    });
    if (error) throw new Error(traduzErro(error.message));
    logActivity({ tipo: "signup", nome: input.nome });
  }, []);

  const logout = useCallback(async () => {
    if (user) logActivity({ tipo: "logout", nome: user.nome, user_id: user.id });
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  const refresh = useCallback(async () => {
    const appUser = await loadAppUser(session);
    setUser(appUser);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading, login, signup, logout, refresh }),
    [user, session, loading, login, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "E-mail já cadastrado";
  if (m.includes("password should be at least")) return "Senha muito curta (mínimo 6 caracteres)";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar";
  return msg;
}
