import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eventStatus } from "@/lib/events";
import { ArrowUpRight, Calendar, MapPin, Clock } from "lucide-react";
import PublicPage, {
  EmptyState,
  PageIntro,
} from "@/components/layout/PublicPage";

export const revalidate = 0;
export default async function EventsPage() {
  const events = await prisma.event.findMany({ orderBy: { startDate: "asc" } });
  return (
    <PublicPage>
      <PageIntro
        eyebrow="AET in motion"
        title={
          <>
            Terhubung lewat
            <br />
            <span>pengalaman bersama.</span>
          </>
        }
        description="Agenda dan kegiatan Himpunan Mahasiswa AET PCR. Temukan kesempatan untuk belajar, bertemu, dan mengambil bagian."
      >
        <span className="page-index">02 / KEGIATAN</span>
      </PageIntro>
      <section className="site-container content-section">
        <div className="collection-toolbar">
          <strong>Agenda komunitas</strong>
          <span>{events.length} kegiatan · Urut berdasarkan tanggal</span>
        </div>
        {events.length === 0 ? (
          <EmptyState
            icon={<Calendar size={27} />}
            title="Nantikan kegiatan berikutnya"
            description="Belum ada kegiatan yang ditambahkan. Jadwal dan informasi kegiatan akan tersedia di halaman ini."
          />
        ) : (
          <div className="content-grid">
            {events.map((event) => {
              const status = eventStatus(event.startDate, event.endDate);
              const ended = status === 'past';
              return (
                <Link
                  href={`/events/${event.id}`}
                  key={event.id}
                  className="editorial-card"
                >
                  <div className="editorial-cover">
                    {event.imageUrl ? (
                      <Image
                        src={event.imageUrl}
                        alt={event.title}
                        fill
                        unoptimized
                        sizes="(min-width:1024px) 33vw,(min-width:640px) 50vw,100vw"
                      />
                    ) : (
                      <div className="cover-placeholder">
                        <Calendar size={32} strokeWidth={1.2} />
                        <span>AET ACTIVITIES</span>
                      </div>
                    )}
                    <div className="event-date">
                      <span>
                        {new Date(event.startDate).toLocaleDateString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          month: "short",
                        })}
                      </span>
                      <strong>{new Date(event.startDate).toLocaleDateString("id-ID", { day: "numeric", timeZone: "Asia/Jakarta" })}</strong>
                    </div>
                  </div>
                  <div className="editorial-body">
                    <div className="editorial-meta">
                      <span
                        className={`status-badge ${ended ? "neutral" : "success"}`}
                      >
                        {ended ? "Kegiatan lampau" : status === 'ongoing' ? "Sedang berlangsung" : "Akan datang"}
                      </span>
                      <span>{new Date(event.startDate).toLocaleDateString('id-ID', { year: 'numeric', timeZone: 'Asia/Jakarta' })}</span>
                    </div>
                    <h2>{event.title}</h2>
                    <div className="event-info">
                      <span>
                        <Clock size={13} />
                        {new Date(event.startDate).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WIB
                      </span>
                      {event.location && (
                        <span>
                          <MapPin size={13} />
                          {event.location}
                        </span>
                      )}
                    </div>
                    <p>{event.description}</p>
                    <div className="editorial-bottom">
                      <span>Detail kegiatan</span>
                      <ArrowUpRight size={17} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </PublicPage>
  );
}
