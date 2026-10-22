import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Brand from "./Brand";

export default function Footer() {
  return (
    <footer className="public-footer">
      <div className="site-container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              Ruang bertemu ide, teknologi,
              <br />
              dan komunitas AET PCR.
            </p>
          </div>
          <nav aria-label="Navigasi footer">
            <Link href="/news">Berita</Link>
            <Link href="/events">Kegiatan</Link>
            <Link href="/team">Tim AET</Link>
            <a
              href="https://tet.pcr.ac.id/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Website program studi <ArrowUpRight size={14} />
            </a>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Association of <span>Electro</span>
            nics Telecommunication
          </p>
          <span>Politeknik Caltex Riau · Pekanbaru</span>
        </div>
      </div>
    </footer>
  );
}
