import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowUpRight, Calendar, Newspaper } from "lucide-react";
import PublicPage, {
  EmptyState,
  PageIntro,
} from "@/components/layout/PublicPage";

export const revalidate = 0;
export default async function NewsPage() {
  const newsList = await prisma.news.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <PublicPage>
      <PageIntro
        eyebrow="The AET Journal"
        title={
          <>
            Cerita, wawasan,
            <br />
            <span>dan langkah baru.</span>
          </>
        }
        description="Kabar dari lingkungan AET PCR. Ikuti cerita komunitas, perkembangan teknologi, dan ide yang layak dibagikan."
      >
        <span className="page-index">01 / BERITA</span>
      </PageIntro>
      <section className="site-container content-section">
        <div className="collection-toolbar">
          <strong>Semua artikel</strong>
          <span>{newsList.length} artikel dipublikasikan</span>
        </div>
        {newsList.length === 0 ? (
          <EmptyState
            icon={<Newspaper size={27} />}
            title="Cerita baru sedang disiapkan"
            description="Belum ada berita yang dipublikasikan. Kunjungi kembali halaman ini untuk kabar terbaru dari AET PCR."
          />
        ) : (
          <div className="content-grid news-grid">
            {newsList.map((news) => (
              <Link
                key={news.id}
                href={`/news/${news.slug}`}
                className="editorial-card"
              >
                <div className="editorial-cover">
                  {news.imageUrl ? (
                    <Image
                      src={news.imageUrl}
                      alt={news.title}
                      fill
                      unoptimized
                      sizes="(min-width:1024px) 33vw,(min-width:640px) 50vw,100vw"
                    />
                  ) : (
                    <div className="cover-placeholder">
                      <Newspaper size={32} strokeWidth={1.2} />
                      <span>AET JOURNAL</span>
                    </div>
                  )}
                </div>
                <div className="editorial-body">
                  <div className="editorial-meta">
                    <Calendar size={12} />
                    <time dateTime={new Date(news.createdAt).toISOString()}>
                      {new Date(news.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <h2>{news.title}</h2>
                  <p>
                    {news.summary || news.content.substring(0, 120) + "..."}
                  </p>
                  <div className="editorial-bottom">
                    <span>Baca cerita</span>
                    <ArrowUpRight size={17} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicPage>
  );
}
