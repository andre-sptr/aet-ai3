"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import Brand from "./Brand";
import Dialog from "@/components/shared/Dialog";

const links = [
  { href: "/news", label: "Berita" },
  { href: "/events", label: "Kegiatan" },
  { href: "/team", label: "Tim AET" },
];

export default function PublicNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <>
      <a href="#main-content" className="skip-link">
        Langsung ke konten
      </a>
      <header className="public-header">
        <div className="site-container nav-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Navigasi utama">
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
              Beranda
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  pathname.startsWith(link.href) ? "page" : undefined
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <Link className="button button-primary nav-cta" href="/#pilih-mode">
              Mulai dengan AI <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon-button mobile-menu-button"
              aria-label="Buka navigasi"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Jelajahi AET"
        className="nav-dialog"
      >
        <nav className="mobile-nav" aria-label="Navigasi mobile">
          {[{ href: "/", label: "Beranda" }, ...links].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
              <ArrowUpRight size={18} />
            </Link>
          ))}
          <Link
            href="/#pilih-mode"
            onClick={() => setOpen(false)}
            className="button button-primary"
          >
            Mulai dengan AI <ArrowUpRight size={18} />
          </Link>
        </nav>
        <p className="muted small">Himpunan Mahasiswa AET PCR</p>
      </Dialog>
    </>
  );
}
