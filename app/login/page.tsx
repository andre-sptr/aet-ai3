"use client";

import { useState } from "react";
import Link from "next/link";
import Brand from "@/components/layout/Brand";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.message || "Login gagal. Silakan coba lagi.");
      }
    } catch {
      setError("Terjadi kesalahan sistem. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell" id="main-content">
      <div className="login-layout">
        <aside className="login-story">
          <Brand />
          <div>
            <div className="eyebrow text-blue-300">
              <span />
              AET Content Workspace
            </div>
            <h2>
              Setiap cerita
              <br />
              dimulai dari sini.
            </h2>
            <p>
              Ruang pengelola untuk menjaga informasi dan aktivitas komunitas
              AET PCR tetap terhubung.
            </p>
          </div>
          <small>POLITEKNIK CALTEX RIAU / PEKANBARU</small>
        </aside>
        <section className="login-form-panel">
          <h1>Masuk ke workspace.</h1>
          <p>Gunakan akun administrator untuk mengelola konten AET AI.</p>
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <label className="field">
              <span>Username</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username administrator"
                required
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                required
                disabled={loading}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="button button-primary"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  Masuk dashboard <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <Link href="/">
            <ArrowLeft size={13} />
            Kembali ke website AET AI
          </Link>
        </section>
      </div>
    </main>
  );
}
