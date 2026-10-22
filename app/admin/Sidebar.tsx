"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  Calendar,
  Users,
  ArrowUpRight,
  LogOut,
  Menu,
  Loader2,
} from "lucide-react";
import Brand from "@/components/layout/Brand";
import Dialog from "@/components/shared/Dialog";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const items = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Berita", href: "/admin/news", icon: Newspaper },
    { name: "Kegiatan", href: "/admin/events", icon: Calendar },
    { name: "Struktur tim", href: "/admin/team", icon: Users },
  ];
  const logout = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout gagal. Coba lagi.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Logout gagal.");
      setLoading(false);
    }
  };
  const navigation = (
    <>
      <p className="rail-label">Kelola workspace</p>
      <nav className="admin-nav" aria-label="Navigasi admin">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={
              (
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href)
              )
                ? "page"
                : undefined
            }
          >
            <item.icon size={17} />
            {item.name}
          </Link>
        ))}
      </nav>
    </>
  );
  const actions = (
    <div className="admin-sidebar-actions">
      <Link href="/">
        <ArrowUpRight size={17} />
        Lihat website
      </Link>
      <button onClick={logout} disabled={loading}>
        {loading ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <LogOut size={17} />
        )}
        {loading ? "Keluar..." : "Keluar dari admin"}
      </button>
      {error && (
        <p role="alert" className="small text-red-600 px-3">
          {error}
        </p>
      )}
    </div>
  );
  return (
    <>
      <aside className="admin-sidebar">
        <Brand admin />
        {navigation}
        {actions}
      </aside>
      <div className="admin-mobile-bar">
        <Brand admin />
        <button
          onClick={() => setOpen(true)}
          className="icon-button"
          aria-label="Buka menu admin"
          aria-expanded={open}
        >
          <Menu size={21} />
        </button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="AET Admin"
        className="nav-dialog"
      >
        <div className="flex flex-col min-h-[65dvh]">
          {navigation}
          {actions}
        </div>
      </Dialog>
    </>
  );
}
