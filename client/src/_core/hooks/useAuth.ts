import { useState, useEffect } from "react";

type User = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  profileImageUrl: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.ok ? res.json() : null)
      .then(data => { setUser(data); setIsLoading(false); })
      .catch(() => { setUser(null); setIsLoading(false); });
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  return { user, isLoading, loading: isLoading, logout };
}
