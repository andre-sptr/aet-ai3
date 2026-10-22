import { type ReactNode } from "react";
import PublicNavigation from "./PublicNavigation";
import Footer from "./Footer";

export default function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="public-page">
      <PublicNavigation />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div className="site-container">
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <div className="page-intro-row">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
