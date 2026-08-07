"use client";

import * as React from "react";

import type { AuthProfile, Member } from "@/domain/types";
import { getSupabaseMode } from "@/lib/supabase/config";
import { useThrift } from "@/providers/thrift-provider";

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: AuthProfile | null;
  member: Member | null;
  loading: boolean;
  mode: "supabase" | "demo";
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithName: (name: string) => void;
  signInDemo: (memberId: string) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const DEMO_SESSION_KEY = "thriftwise-demo-session";
const MEMBER_SESSION_KEY = "thriftwise-member-session";

const DEMO_ACCOUNTS: Record<string, { memberId: string; name: string }> = {
  "hassana@thriftwise.app": { memberId: "hassana", name: "Hassana" },
  "habiba@thriftwise.app": { memberId: "habiba", name: "Habiba" },
  "yusuf@thriftwise.app": { memberId: "yusuf", name: "Yusuf" },
  "junior@thriftwise.app": { memberId: "junior", name: "Junior" },
  "me@thriftwise.app": { memberId: "me", name: "Me" },
};

const GUEST_MEMBER_ID = "me";

function demoProfileFor(memberId: string, email: string): AuthProfile {
  const account = Object.entries(DEMO_ACCOUNTS).find(([, v]) => v.memberId === memberId);
  return {
    id: `profile-${memberId}`,
    memberId,
    email: account ? account[0] : email,
    displayName: account ? account[1].name : memberId,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = getSupabaseMode();
  const { state, memberLookup } = useThrift();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [profile, setProfile] = React.useState<AuthProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  const member = React.useMemo(
    () => (profile ? memberLookup(profile.memberId) : null),
    [profile, memberLookup]
  );

  const restoreMemberSession = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem(MEMBER_SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as { memberId: string; email?: string };
      const found = memberLookup(session.memberId);
      if (!found) {
        window.localStorage.removeItem(MEMBER_SESSION_KEY);
        return;
      }
      setUser({
        uid: `member-${found.id}`,
        email: found.email ?? session.email ?? null,
        displayName: found.name,
        photoURL: null,
      });
      setProfile({
        id: `member-${found.id}`,
        memberId: found.id,
        email: found.email ?? "",
        displayName: found.name,
        createdAt: found.joinedAt,
      });
    } catch {
      /* ignore */
    }
  }, [memberLookup]);

  // Restore a name-based member session once the thrift state is available.
  // Supabase email sessions (admin) always take precedence.
  React.useEffect(() => {
    if (mode !== "supabase" || !state || user) return;
    let cancelled = false;
    (async () => {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const sb = getSupabaseClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!cancelled && !session?.user) {
        restoreMemberSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, state, user, restoreMemberSession]);

  React.useEffect(() => {
    if (mode === "demo") {
      try {
        const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as { memberId: string; email?: string };
          const account = Object.entries(DEMO_ACCOUNTS).find(
            ([, v]) => v.memberId === session.memberId
          );
          setUser({
            uid: session.memberId,
            email: session.email ?? (account ? account[0] : `${session.memberId}@thriftwise.app`),
            displayName: account ? account[1].name : session.memberId,
            photoURL: null,
          });
          setProfile(demoProfileFor(session.memberId, session.email ?? ""));
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }

    let unsubAuth: (() => void) | undefined;
    import("@/lib/supabase/client").then(async ({ getSupabaseClient }) => {
      const sb = getSupabaseClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session?.user) {
        applyUser(session.user, session.user.id);
        await loadSupabaseProfile(session.user.id);
      }
      const { data: sub } = sb.auth.onAuthStateChange(async (_event, supabaseSession) => {
        if (supabaseSession?.user) {
          window.localStorage.removeItem(MEMBER_SESSION_KEY);
          applyUser(supabaseSession.user, supabaseSession.user.id);
          await loadSupabaseProfile(supabaseSession.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
      unsubAuth = sub.subscription.unsubscribe;
      setLoading(false);
    });
    return () => unsubAuth?.();
  }, [mode]);

  function applyUser(supabaseUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }, uid: string) {
    setUser({
      uid,
      email: supabaseUser.email ?? null,
      displayName: (supabaseUser.user_metadata?.full_name as string) ?? (supabaseUser.user_metadata?.name as string) ?? supabaseUser.email ?? null,
      photoURL: (supabaseUser.user_metadata?.avatar_url as string) ?? null,
    });
  }

  async function loadSupabaseProfile(uid: string) {
    try {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const sb = getSupabaseClient();
      const { data } = await sb
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setProfile({
          id: data.id,
          memberId: data.member_id,
          email: data.email ?? "",
          displayName: data.display_name ?? "",
          photoUrl: data.photo_url ?? undefined,
          createdAt: data.created_at ?? new Date().toISOString(),
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (mode === "demo") {
      const normalized = email.trim().toLowerCase();
      const account = DEMO_ACCOUNTS[normalized];
      const memberId = account?.memberId ?? GUEST_MEMBER_ID;
      const name = account?.name ?? "Me";
      const resolvedEmail = account ? normalized : normalized || "me@thriftwise.app";
      window.localStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ memberId, email: resolvedEmail })
      );
      setUser({ uid: memberId, email: resolvedEmail, displayName: name, photoURL: null });
      setProfile(demoProfileFor(memberId, resolvedEmail));
      return;
    }

    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const sb = getSupabaseClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const su = data.user;
    if (su) {
      window.localStorage.removeItem(MEMBER_SESSION_KEY);
      applyUser(su, su.id);
      await loadSupabaseProfile(su.id);
    }
  }

  async function signInWithGoogle() {
    if (mode === "demo") {
      signInDemo("me");
      return;
    }
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  function signInDemo(memberId: string) {
    const account = Object.entries(DEMO_ACCOUNTS).find(([, v]) => v.memberId === memberId);
    const email = account ? account[0] : `${memberId}@thriftwise.app`;
    window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ memberId, email }));
    window.localStorage.removeItem(MEMBER_SESSION_KEY);
    setUser({ uid: memberId, email, displayName: account?.[1].name ?? memberId, photoURL: null });
    setProfile(demoProfileFor(memberId, email));
  }

  function signInWithName(name: string) {
    const normalized = name.trim().toLowerCase();
    const found =
      state?.members.find((m) => m.name.toLowerCase() === normalized) ??
      state?.members.find((m) =>
        m.name.toLowerCase().split(/\s+/).some((part) => part.length >= 3 && normalized.includes(part))
      ) ??
      state?.members.find((m) => m.name.toLowerCase().startsWith(normalized)) ??
      state?.members.find((m) => m.name.toLowerCase().includes(normalized));
    if (!found) {
      throw new Error(`"${name}" isn't part of the family yet. Ask the admin to add you.`);
    }
    const email = found.email ?? "";
    window.localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify({ memberId: found.id, email }));
    if (mode === "demo") {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    }
    setUser({ uid: `member-${found.id}`, email: email || null, displayName: found.name, photoURL: null });
    setProfile({
      id: `member-${found.id}`,
      memberId: found.id,
      email,
      displayName: found.name,
      createdAt: found.joinedAt,
    });
  }

  async function signOut() {
    if (mode === "demo") {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      setUser(null);
      setProfile(null);
      return;
    }
    window.localStorage.removeItem(MEMBER_SESSION_KEY);
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    await getSupabaseClient().auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function resetPassword(email: string) {
    if (mode === "demo") return;
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    await getSupabaseClient().auth.resetPasswordForEmail(email);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        member,
        loading,
        mode,
        signInWithEmail,
        signInWithGoogle,
        signInWithName,
        signInDemo,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
