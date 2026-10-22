import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import PublicPage from "@/components/layout/PublicPage";
import ArticleContent from "@/components/shared/ArticleContent";
import ShareButton from "./ShareButton";

export const revalidate = 0;
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Existing route segment is named slug; data lookup deliberately remains ID-based.
  const event = await prisma.event.findUnique({ where: { id: slug } });
  if (!event) notFound();
  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <PublicPage>
      <article>
        <header className="article-header">
          <Link href="/events" className="article-back">
            <ArrowLeft size={15} />
            Kembali ke kegiatan
          </Link>
          <div className="eyebrow">
            <span />
            AET Activities
          </div>
          <h1>{event.title}</h1>
          <div className="article-meta">
            <span>
              <Calendar size={14} />
              <time dateTime={new Date(event.startDate).toISOString()}>
                {new Date(event.startDate).toLocaleDateString("id-ID", {
                          timeZone: "Asia/Jakarta",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </span>
            <span>
              <Clock size={14} />
              {formatTime(event.startDate)}{" "}
              {event.endDate && `– ${formatTime(event.endDate)}`} WIB
            </span>
            {event.location && (
              <span>
                <MapPin size={14} />
                {event.location}
              </span>
            )}
          </div>
        </header>
        {event.imageUrl && (
          <div className="article-cover">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              unoptimized
              priority
              sizes="(min-width:1200px) 1136px,100vw"
            />
          </div>
        )}
        <div className="article-reading">
          <ArticleContent content={event.description} />
          <div className="share-section">
            <span>Ajak temanmu ikut mengambil bagian.</span>
            <ShareButton />
          </div>
        </div>
      </article>
    </PublicPage>
  );
}
