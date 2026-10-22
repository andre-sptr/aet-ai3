import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cpu } from "lucide-react";
import PublicPage from "@/components/layout/PublicPage";

export default function ComingSoon() {
  return (
    <PublicPage>
      <section className="coming-section">
        <div className="coming-panel">
          <div className="coming-copy">
            <div className="eyebrow">
              <span />
              Sedang dikembangkan
            </div>
            <h1>
              Masih ada ide
              <br />
              yang sedang
              <br />
              kami bangun.
            </h1>
            <p>
              Ruang ini disiapkan untuk pengembangan AET AI berikutnya. Sambil
              menunggu, gunakan mode AI yang tersedia atau ikuti kabar dari
              komunitas.
            </p>
            <Link href="/" className="button button-primary">
              Kembali ke AET AI <ArrowRight size={16} />
            </Link>
            <div className="community-links">
              <a
                href="https://www.instagram.com/andree.sptrr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram pengembang <ArrowUpRight size={15} />
              </a>
              <a
                href="https://www.linkedin.com/in/andre-sptr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn pengembang <ArrowUpRight size={15} />
              </a>
              <a
                href="https://github.com/andre-sptr/aet-ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Proyek di GitHub <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <div className="coming-art" aria-hidden="true">
            <Cpu />
            <p>THE NEXT CHAPTER / AET AI</p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
