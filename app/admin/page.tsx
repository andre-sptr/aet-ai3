import Link from "next/link";
import {
  Newspaper,
  Calendar,
  Users,
  ArrowUpRight,
  Plus,
  BookOpen,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;
export default async function AdminDashboard() {
  const [newsCount, eventsCount, teamCount] = await Promise.all([
    prisma.news.count(),
    prisma.event.count(),
    prisma.teamMember.count(),
  ]);
  const cards = [
    {
      name: "Berita & artikel",
      count: newsCount,
      unit: "artikel",
      href: "/admin/news",
      icon: Newspaper,
    },
    {
      name: "Kegiatan & agenda",
      count: eventsCount,
      unit: "kegiatan",
      href: "/admin/events",
      icon: Calendar,
    },
    {
      name: "Struktur tim",
      count: teamCount,
      unit: "anggota",
      href: "/admin/team",
      icon: Users,
    },
  ];
  return (
    <>
      <div className="admin-heading">
        <div>
          <div className="eyebrow">
            <span />
            Workspace overview
          </div>
          <h1>Selamat datang kembali.</h1>
          <p>Kelola informasi, kegiatan, dan orang-orang di balik AET PCR.</p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="button button-secondary"
        >
          Lihat website <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="admin-kpis">
        {cards.map((card) => (
          <Link className="kpi-card" key={card.href} href={card.href}>
            <div className="kpi-top">
              <span>{card.name}</span>
              <card.icon size={19} />
            </div>
            <strong>{card.count}</strong>
            <span>
              <span>Kelola {card.unit}</span>
              <ArrowUpRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      <div className="admin-guide">
        <div className="admin-guide-card">
          <h2>
            <Plus size={17} className="inline mr-2 text-blue-600" />
            Buat pembaruan berikutnya
          </h2>
          <p>
            Bagikan cerita dari komunitas. Tambahkan judul, ringkasan, konten,
            dan gambar sebelum mempublikasikannya.
          </p>
          <Link href="/admin/news" className="text-link">
            Tulis berita <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="admin-guide-card">
          <h2>
            <BookOpen size={17} className="inline mr-2 text-blue-600" />
            Sebelum dipublikasikan
          </h2>
          <ul>
            <li>
              Periksa status Published agar berita tampil di listing publik.
            </li>
            <li>Pastikan tanggal dan lokasi kegiatan sudah sesuai.</li>
            <li>Gunakan urutan anggota untuk mengatur struktur tim.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
