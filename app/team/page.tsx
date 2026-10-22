import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ArrowUpRight, Users } from "lucide-react";
import PublicPage, {
  EmptyState,
  PageIntro,
} from "@/components/layout/PublicPage";

export const revalidate = 0;
function getSocials(value: string | null): [string, string][] {
  if (!value) return [];
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.entries(data).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && /^https?:\/\//i.test(entry[1]),
    );
  } catch {
    return [];
  }
}
export default async function TeamPage() {
  const team = await prisma.teamMember.findMany({ orderBy: { order: "asc" } });
  return (
    <PublicPage>
      <PageIntro
        eyebrow="People behind the progress"
        title={
          <>
            Bergerak bersama.
            <br />
            <span>Bertumbuh sebagai AET.</span>
          </>
        }
        description="Kenali orang-orang di balik Himpunan Mahasiswa AET Politeknik Caltex Riau. Membawa semangat kolaborasi dari ide menjadi aksi."
      >
        <span className="page-index">03 / TIM AET</span>
      </PageIntro>
      <section className="site-container content-section">
        <div className="collection-toolbar">
          <strong>Struktur organisasi</strong>
          <span>Himpunan Mahasiswa AET PCR</span>
        </div>
        {team.length === 0 ? (
          <EmptyState
            icon={<Users size={27} />}
            title="Kenali tim kami segera"
            description="Data struktur organisasi belum ditambahkan. Informasi anggota akan ditampilkan sesuai data resmi himpunan."
          />
        ) : (
          <div className="team-grid">
            {team.map((member) => (
              <div key={member.id} className="team-card">
                <div className="team-photo">
                  {member.photoUrl ? (
                    <Image
                      src={member.photoUrl}
                      alt={member.name}
                      fill
                      unoptimized
                      sizes="(min-width:1024px) 33vw,(min-width:640px) 50vw,100vw"
                    />
                  ) : (
                    <span
                      className="team-initials"
                      aria-label="Foto belum tersedia"
                    >
                      {member.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  )}
                </div>
                <div className="team-body">
                  <span>{member.position}</span>
                  <h2>{member.name}</h2>
                  {member.bio && <p>{member.bio}</p>}
                  {getSocials(member.socials).length > 0 && (
                    <div className="team-socials">
                      {getSocials(member.socials).map(([label, href]) => (
                        <a
                          href={href}
                          key={label}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label}
                          <ArrowUpRight size={12} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicPage>
  );
}
