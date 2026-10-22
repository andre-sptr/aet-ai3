"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Native modal: top layer, focus containment, Escape and focus restoration. */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const portalTarget = mounted ? document.body : null;
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, portalTarget]);
  if (!portalTarget) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      className={`aet-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busyRef.current)
          closeRef.current();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Tutup dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>,
    portalTarget,
  );
}
