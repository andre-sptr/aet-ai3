import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import PublicPage from "@/components/layout/PublicPage";
import ArticleContent from "@/components/shared/ArticleContent";
import ShareButton from "./ShareButton";
import { cookies } from "next/headers";
import { isAdminToken } from "@/lib/auth";

export const revalidate = 0;
export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const news = await prisma.news.findUnique({ where: { slug } });
  if (!news || (!news.published && !isAdminToken((await cookies()).get("admin_session")?.value))) notFound();
  return (
    <PublicPage>
      <article>
        <header className="article-header">
          <Link href="/news" className="article-back">
            <ArrowLeft size={15} />
            Kembali ke berita
          </Link>
          <div className="eyebrow">
            <span />
            AET Journal
          </div>
          <h1>{news.title}</h1>
          <div className="article-meta">
            <span>
              <Calendar size={14} />
              <time dateTime={new Date(news.createdAt).toISOString()}>
                {new Date(news.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </span>
            <span>
              <User size={14} />
              Admin AET AI
            </span>
          </div>
        </header>
        {news.imageUrl && (
          <div className="article-cover">
            <Image
              src={news.imageUrl}
              alt={news.title}
              fill
              unoptimized
              priority
              sizes="(min-width:1200px) 1136px,100vw"
            />
          </div>
        )}
        <div className="article-reading">
          <ArticleContent content={news.content} />
          <div className="share-section">
            <span>Bagikan cerita ini dengan temanmu.</span>
            <ShareButton />
          </div>
        </div>
      </article>
    </PublicPage>
  );
}
