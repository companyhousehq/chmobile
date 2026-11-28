import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, setApiHandlers } from "@/lib/api/runtime";
import { gateFromRequirements, type Gate } from "@/lib/auth/gate";
import {
  clearMemoryToken,
  clearPendingLinkTokens,
  clearToken,
  loadToken,
  saveToken,
} from "@/lib/auth/tokenStore";
import { deleteWipedDirectories } from "@/lib/files";
import { clearCrashUser } from "@/lib/sentry";
import { clearAllStores } from "@/lib/storage/mmkv";
import { signOutWipe } from "@/lib/session/wipe";
import type { Problem } from "@/lib/types";

type Status = "loading" | "signedOut" | "signedIn";

interface Session {
  status: Status;
  /** Set by any 426; blocks every other route until the app is updated (AC12). */
  updateRequired: Problem | null;
  /** True after a 401 ended the session; the sign-in screen explains it once (M6). */
  sessionEnded: boolean;
  clearSessionEnded: () => void;
  /** The step the API still wants before the session is usable (factor, enrolment, consent). */
  gate: Gate | null;
  setGate: (gate: Gate | null) => void;
  /** Applies the `requirements` a login or MFA response returned. */
  applyRequirements: (requirements: readonly string[] | undefined) => void;
  signIn: (token: string, requirements?: readonly string[]) => Promise<void>;
  /** Explicit sign-out: best-effort server calls, then the wipe. */
  signOut: () => Promise<void>;
  /** The wipe only (401, five failed unlocks, account closure). */
  wipe: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [updateRequired, setUpdateRequired] = useState<Problem | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [gate, setGate] = useState<Gate | null>(null);
  const wiping = useRef(false);

  const wipe = useCallback(async () => {
    if (wiping.current) return;
    wiping.current = true;
    try {
      await signOutWipe({
        clearMemoryToken: () => clearMemoryToken(),
        cancelRequests: () => api.abortAll(),
        clearQueryCache: () => queryClient.clear(),
        clearStorage: () => clearAllStores(),
        deleteFiles: () => deleteWipedDirectories(),
        clearSecrets: async () => {
          await clearToken();
          await clearPendingLinkTokens();
        },
        clearCrashUser: () => clearCrashUser(),
        routeToSignIn: () => {
          setGate(null);
          setStatus("signedOut");
        },
      });
    } finally {
      wiping.current = false;
    }
  }, [queryClient]);

  const signOut = useCallback(async () => {
    // Best effort: a failure here must never keep the user signed in.
    await api.request("/v1/me/push-devices/current", { method: "DELETE" }).catch(() => {});
    await api.request("/v1/auth/logout", { method: "POST" }).catch(() => {});
    await wipe();
    setSessionEnded(false);
  }, [wipe]);

  const applyRequirements = useCallback((requirements: readonly string[] | undefined) => {
    setGate(gateFromRequirements(requirements));
  }, []);

  const signIn = useCallback(async (token: string, requirements?: readonly string[]) => {
    await saveToken(token);
    setSessionEnded(false);
    setGate(gateFromRequirements(requirements));
    setStatus("signedIn");
  }, []);

  useEffect(() => {
    setApiHandlers({
      onUnauthenticated: async () => {
        setSessionEnded(true);
        await wipe();
      },
      onUpdateRequired: setUpdateRequired,
      // factor-required is ambiguous (challenge or enrolment): the gate screen asks /v1/me/mfa.
      onGateRequired: (slug) =>
        setGate((g) => g ?? (slug === "consent-required" ? "consent" : "unknown")),
    });
  }, [wipe]);

  useEffect(() => {
    let cancelled = false;
    loadToken()
      .then((token) => !cancelled && setStatus(token ? "signedIn" : "signedOut"))
      .catch(() => !cancelled && setStatus("signedOut"));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      updateRequired,
      sessionEnded,
      clearSessionEnded: () => setSessionEnded(false),
      gate,
      setGate,
      applyRequirements,
      signIn,
      signOut,
      wipe,
    }),
    [status, updateRequired, sessionEnded, gate, applyRequirements, signIn, signOut, wipe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
