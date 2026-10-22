import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminToken } from "@/lib/auth";
import AdminSidebar from "./Sidebar";
import { LayoutGrid } from "lucide-react";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminToken((await cookies()).get("admin_session")?.value)) redirect("/login");
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            <LayoutGrid size={15} />
            AET Admin <span className="text-slate-300">/</span>Content workspace
          </span>
          <span>
            Administrator <span className="admin-avatar">AD</span>
          </span>
        </header>
        <main className="admin-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
