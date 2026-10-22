import Image from "next/image";
import Link from "next/link";

export default function Brand({
  admin = false,
  compact = false,
}: {
  admin?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="brand"
      aria-label={admin ? "AET Admin — Dashboard" : "AET AI — Beranda"}
    >
      <Image
        src="/favicon.ico"
        alt="Logo AET PCR"
        width={42}
        height={42}
        unoptimized
        priority
      />
      <span>
        <strong>
          AET <span>{admin ? "Admin" : "AI"}</span>
          <i />
        </strong>
        {!compact && (
          <small>
            {admin ? "Content workspace" : "Politeknik Caltex Riau"}
          </small>
        )}
      </span>
    </Link>
  );
}
