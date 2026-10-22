"use client";

import { ChatModeConfig } from "@/types";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Code2,
  Cpu,
  FileText,
  GraduationCap,
  Layers,
  MapPin,
  MessageCircle,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import PublicNavigation from "@/components/layout/PublicNavigation";
import Footer from "@/components/layout/Footer";

const CHAT_MODES: ChatModeConfig[] = [
  {
    id: "daily",
    title: "Smart Companion",
    description:
      "Temukan sudut pandang baru. Diskusikan ide, susun rencana, dan selesaikan pertanyaan sehari-hari.",
    icon: "message",
    systemInstruction: "",
    color: "purple",
  },
  {
    id: "report",
    title: "Academic Writer",
    description:
      "Dari kerangka awal hingga analisis. Susun laporan dan tulisan akademik dengan alur yang lebih terarah.",
    icon: "file",
    systemInstruction: "",
    color: "green",
  },
  {
    id: "coding",
    title: "Coding Expert",
    description:
      "Pahami logikanya, pecahkan masalahnya. Tulis kode, telusuri bug, dan pelajari konsep teknis bersama AI.",
    icon: "code",
    systemInstruction: "",
    color: "blue",
  },
];

export default function LandingPage({
  onSelectMode,
}: {
  onSelectMode: (mode: ChatModeConfig) => void;
}) {
  return (
    <div className="public-page">
      <PublicNavigation />
      <main id="main-content">
        <section className="landing-hero">
          <div className="site-container">
            <div className="hero-layout">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span />
                  Built for AET. Open to ideas.
                </div>
                <h1>
                  Intelligence
                  <br />
                  for <em>every idea.</em>
                </h1>
                <p>
                  Ruang berpikir baru untuk mahasiswa AET PCR. Eksplorasi ide,
                  tulis karya akademik, dan kembangkan kode bersama asisten AI
                  dalam satu workspace.
                </p>
                <div className="hero-actions">
                  <a href="#pilih-mode" className="button button-primary">
                    Temukan mode kamu <ArrowRight size={16} />
                  </a>
                  <Link href="/team" className="button button-secondary">
                    Kenali AET PCR <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div className="hero-note">
                  <GraduationCap size={15} />
                  <span>
                    Dirancang untuk belajar, berkarya, dan berkembang.
                  </span>
                </div>
              </div>
              <div
                className="product-preview"
                role="img"
                aria-label="Pratinjau tampilan workspace AET AI untuk diskusi dan penulisan kode"
              >
                <div className="preview-top">
                  <strong>
                    <Sparkles size={15} />
                    AET AI Workspace
                  </strong>
                  <span>PRATINJAU INTERFACE</span>
                </div>
                <div className="preview-session">
                  <span className="preview-mode">
                    <Code2 size={12} />
                    Coding Expert <span> / </span>Eksplorasi konsep
                  </span>
                  <div className="preview-user">
                    Bantu jelaskan bagaimana sensor membaca data dan
                    mengirimkannya ke sistem IoT.
                  </div>
                  <div className="preview-ai">
                    <div className="preview-avatar">
                      <Sparkles size={14} />
                    </div>
                    <div className="preview-answer">
                      <strong>Dari data fisik menjadi informasi.</strong>
                      <ol>
                        <li>Sensor mengukur besaran di lingkungan.</li>
                        <li>Mikrokontroler membaca dan memproses data.</li>
                        <li>Data dikirim untuk ditampilkan atau dianalisis.</li>
                      </ol>
                      <div className="preview-code">
                        <span>sensor</span>.read()
                        <br />
                        &nbsp; ↳ process(data)
                        <br />
                        &nbsp; ↳ <span>publish</span>(&quot;aet/sensor&quot;,
                        data)
                      </div>
                    </div>
                  </div>
                </div>
                <div className="preview-composer">
                  <span>
                    <Paperclip size={13} />
                    Lanjutkan ide kamu...
                  </span>
                  <Send size={14} />
                </div>
                <p className="preview-caption">
                  Diskusi · Penulisan akademik · Pengembangan kode
                </p>
              </div>
            </div>
            <div className="hero-bottom">
              <span>
                <Layers size={15} />
                Tiga mode, sesuai kebutuhanmu
              </span>
              <span>
                <Cpu size={15} />
                Pilihan model AI dalam satu tempat
              </span>
              <span>
                <BookOpen size={15} />
                Bagian dari komunitas AET PCR
              </span>
            </div>
          </div>
        </section>
        <section id="pilih-mode" className="modes-section">
          <div className="site-container">
            <div className="section-title-row">
              <div>
                <div className="eyebrow">
                  <span />
                  Pilih ruang berpikirmu
                </div>
                <h2>Satu ide. Banyak kemungkinan.</h2>
              </div>
              <p>
                Mulai dari yang kamu butuhkan hari ini.
                <br />
                Pilih mode untuk membuka percakapan.
              </p>
            </div>
            <div className="mode-grid">
              {CHAT_MODES.map((mode, index) => {
                const Icon =
                  mode.id === "daily"
                    ? MessageCircle
                    : mode.id === "report"
                      ? FileText
                      : Braces;
                const labels = [
                  "Think & explore",
                  "Research & write",
                  "Build & understand",
                ];
                return (
                  <button
                    key={mode.id}
                    id={`chat-mode-${mode.id}`}
                    className={`mode-card mode-${mode.id}`}
                    onClick={() => onSelectMode(mode)}
                  >
                    <div className="mode-card-top">
                      <div className="mode-icon">
                        <Icon size={22} strokeWidth={1.7} />
                      </div>
                      <span>0{index + 1} / AI MODE</span>
                    </div>
                    <small>{labels[index]}</small>
                    <h3>{mode.title}</h3>
                    <p>{mode.description}</p>
                    <div className="mode-card-bottom">
                      <span>Mulai percakapan</span>
                      <ArrowUpRight size={19} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <section className="workflow">
          <div className="site-container workflow-layout">
            <div>
              <div className="eyebrow">
                <span />
                Dari pertanyaan ke pemahaman
              </div>
              <h2>
                Mulai sederhana.
                <br />
                Kembangkan bersama.
              </h2>
              <p>
                AI sebagai rekan berpikir. Kamu tetap memegang arah, konteks,
                dan keputusan akhirnya.
              </p>
            </div>
            <div className="workflow-steps">
              {[
                [
                  "01",
                  "Pilih fokusmu",
                  "Buka mode diskusi, akademik, atau coding sesuai pekerjaanmu.",
                ],
                [
                  "02",
                  "Berikan konteks",
                  "Tulis pertanyaan atau sertakan dokumen untuk memperjelas kebutuhan.",
                ],
                [
                  "03",
                  "Olah lebih lanjut",
                  "Tinjau jawaban, ajukan pertanyaan lanjutan, dan verifikasi hal penting.",
                ],
              ].map(([n, title, desc]) => (
                <div key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="community">
          <div className="site-container">
            <div className="community-layout">
              <div className="community-copy">
                <div className="eyebrow">
                  <span />
                  Teknologi bertemu komunitas
                </div>
                <h2>
                  Tumbuh bersama
                  <br />
                  keluarga AET PCR.
                </h2>
                <p>
                  Di balik setiap inovasi, ada orang-orang yang saling
                  terhubung. Kenali Himpunan Mahasiswa AET Politeknik Caltex
                  Riau melalui cerita, kegiatan, dan saluran resmi kami.
                </p>
                <div className="community-links">
                  {[
                    [
                      "https://tet.pcr.ac.id/",
                      "Website program studi",
                      "tet.pcr.ac.id",
                    ],
                    [
                      "https://www.instagram.com/aetpcr/",
                      "Instagram",
                      "@aetpcr",
                    ],
                    ["https://www.youtube.com/@AETPCR", "YouTube", "AETPCR"],
                    ["https://facebook.com/aetpcr/", "Facebook", "AET PCR"],
                  ].map(([href, name, caption]) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={name}
                    >
                      <span>
                        {name} <span className="muted small"> / {caption}</span>
                      </span>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                </div>
              </div>
              <div className="community-map">
                <iframe
                  title="Lokasi Politeknik Caltex Riau"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.6202092674093!2d101.42609689999999!3d0.5709752!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31d5ab67086f2e89%3A0x65a24264fec306bb!2sPoliteknik%20Caltex%20Riau!5e0!3m2!1sid!2sid!4v1766210002355!5m2!1sid!2sid"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="map-caption">
                  <MapPin size={21} />
                  <div>
                    <strong>Politeknik Caltex Riau</strong>
                    <small>Pekanbaru, Riau · Indonesia</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="final-cta">
              <div>
                <h2>Ide berikutnya dimulai dari kamu.</h2>
                <p>
                  Ambil langkah pertama. Buka percakapan dan lihat ke mana idemu
                  berkembang.
                </p>
              </div>
              <a className="button button-white" href="#pilih-mode">
                Jelajahi mode AI <ArrowDown size={16} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
