> **ARSIP BASELINE REDESIGN.** Dokumen ini menjelaskan tahap sebelum 2.1. Untuk hasil terkini baca FINAL_IMPLEMENTATION_REPORT.md dan REGRESSION_TEST_REPORT.md.

# Inventaris perubahan AET AI

Semua path relatif terhadap folder `aetpcr/`.

## File existing yang diubah

- `README.md`
- `app/admin/Sidebar.tsx`
- `app/admin/events/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/news/page.tsx`
- `app/admin/page.tsx`
- `app/admin/team/page.tsx`
- `app/coming-soon/page.tsx`
- `app/events/[slug]/page.tsx`
- `app/events/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/login/page.tsx`
- `app/news/[slug]/page.tsx`
- `app/news/page.tsx`
- `app/page.tsx`
- `app/team/page.tsx`
- `components/ChatInterface.tsx`
- `components/LandingPage.tsx`
- `components/MessageBubble.tsx`
- `components/ui/SkeletonCard.tsx`

## File baru

- `.env.example`
- `components/admin/ContentManager.tsx`
- `components/layout/Brand.tsx`
- `components/layout/Footer.tsx`
- `components/layout/PublicNavigation.tsx`
- `components/layout/PublicPage.tsx`
- `components/shared/ArticleContent.tsx`
- `components/shared/Dialog.tsx`
- `components/shared/MediaViewer.tsx`
- `public/fonts/OFL.txt`
- `public/fonts/plus-jakarta-sans-latin.woff2`

Dokumentasi dan tujuh screenshot ditambahkan pada `docs/`.

## Integritas backend

Sebanyak 22 file yang dilindungi identik byte demi byte dengan ZIP sumber, termasuk 11 route API, empat modul lib, schema dan database SQLite, proxy autentikasi, konfigurasi Next.js, types, serta kedua file package. Rincian hash berada pada `VERIFIKASI_BACKEND.json`.
