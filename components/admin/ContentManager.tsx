"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import {
  Calendar,
  Check,
  Edit3,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import Dialog from "@/components/shared/Dialog";

type Kind = "news" | "events" | "team";
type FormData = Record<string, string | number | boolean>;
type ContentItem = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  content?: string;
  summary?: string | null;
  description?: string;
  location?: string | null;
  startDate?: string;
  endDate?: string | null;
  imageUrl?: string | null;
  photoUrl?: string | null;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
  position?: string;
  bio?: string | null;
  order?: number;
  socials?: string | null;
};
type Feedback = { type: "error" | "success"; text: string } | null;
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
};
const configs: Record<
  Kind,
  {
    title: string;
    intro: string;
    singular: string;
    collection: string;
    imageKey: string;
    initial: FormData;
    fields: Field[];
  }
> = {
  news: {
    title: "Berita & artikel",
    intro: "Kelola cerita dan informasi yang tampil di AET Journal.",
    singular: "berita",
    collection: "Daftar berita",
    imageKey: "imageUrl",
    initial: {
      title: "",
      slug: "",
      summary: "",
      content: "",
      imageUrl: "",
      published: false,
    },
    fields: [
      { name: "title", label: "Judul berita", required: true },
      {
        name: "slug",
        label: "Slug / URL",
        hint: "Dibuat otomatis dari judul saat menambah berita.",
      },
      { name: "summary", label: "Ringkasan", full: true },
      {
        name: "content",
        label: "Konten artikel",
        type: "textarea",
        full: true,
        required: true,
        hint: "Mendukung Markdown: heading, daftar, tautan, gambar, dan tabel.",
      },
    ],
  },
  events: {
    title: "Kegiatan & agenda",
    intro: "Susun informasi kegiatan, jadwal, dan lokasi untuk komunitas.",
    singular: "kegiatan",
    collection: "Daftar kegiatan",
    imageKey: "imageUrl",
    initial: {
      title: "",
      location: "",
      startDate: "",
      endDate: "",
      description: "",
      imageUrl: "",
    },
    fields: [
      { name: "title", label: "Nama kegiatan", required: true },
      { name: "location", label: "Lokasi" },
      {
        name: "startDate",
        label: "Waktu mulai (WIB)",
        type: "datetime-local",
        required: true,
      },
      {
        name: "endDate",
        label: "Waktu selesai (WIB, opsional)",
        type: "datetime-local",
      },
      {
        name: "description",
        label: "Deskripsi kegiatan",
        type: "textarea",
        full: true,
        required: true,
        hint: "Tulis rincian kegiatan. Format Markdown didukung.",
      },
    ],
  },
  team: {
    title: "Tim & struktur",
    intro: "Perbarui profil, jabatan, dan urutan anggota organisasi.",
    singular: "anggota",
    collection: "Daftar anggota",
    imageKey: "photoUrl",
    initial: { name: "", position: "", order: 0, bio: "", photoUrl: "", socials: "" },
    fields: [
      { name: "name", label: "Nama lengkap", required: true },
      { name: "position", label: "Jabatan", required: true },
      {
        name: "order",
        label: "Urutan tampilan",
        type: "number",
        hint: "Angka lebih kecil ditampilkan terlebih dahulu.",
      },
      { name: "bio", label: "Bio singkat", type: "textarea", full: true },
      { name: "socials", label: "Tautan sosial (JSON)", type: "textarea", full: true, hint: 'Contoh: {"instagram":"https://instagram.com/nama"}' },
    ],
  },
};

function formatForInput(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Date(date.getTime() + 7 * 60 * 60000).toISOString().slice(0, 16);
}

function ImageUpload({
  value,
  onChange,
  label,
  onBusy,
  onError,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  onBusy: (busy: boolean) => void;
  onError: (text: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onBusy(true);
    try {
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(file.name)}`,
        { method: "POST", body: file },
      );
      if (!response.ok)
        throw new Error(
          "Gagal mengupload gambar. Periksa koneksi dan konfigurasi penyimpanan.",
        );
      const blob = await response.json();
      onChange(blob.url);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Gagal mengupload gambar.",
      );
    } finally {
      setUploading(false);
      onBusy(false);
      event.target.value = "";
    }
  };
  return (
    <div className="field full">
      <span>{label}</span>
      <div className="upload-field">
        <div className="upload-preview">
          {value ? (
            <Image
              src={value}
              alt="Pratinjau gambar"
              fill
              unoptimized
              sizes="75px"
            />
          ) : (
            <ImageIcon size={22} />
          )}
        </div>
        <div className="upload-controls">
          <label>
            <input
              ref={ref}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
              disabled={uploading}
              className="sr-only"
              aria-label={label}
            />
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading ? "Sedang mengupload..." : "Pilih gambar"}
            <span className="sr-only"> untuk {label}</span>
          </label>
          <input
            type="url"
            className="upload-url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Atau tempel URL gambar..."
            aria-label={`URL ${label}`}
            disabled={uploading}
          />
          <small>Upload gambar atau gunakan URL gambar yang tersedia.</small>
        </div>
      </div>
    </div>
  );
}

export default function ContentManager({ kind }: { kind: Kind }) {
  const config = configs[kind];
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData>({ ...config.initial });
  const [editId, setEditId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const formRef = useRef<HTMLElement>(null);
  const [loadError, setLoadError] = useState("");
  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/${kind}`);
      if (!res.ok) throw new Error("Daftar konten tidak dapat dimuat.");
      const data = await res.json();
      setItems(data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Gagal memuat data.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadItems(); });
    return () => { active = false; };
  }, [loadItems]);
  const reset = () => {
    setEditId(null);
    setEditVersion(null);
    setForm({ ...config.initial });
  };
  const edit = (item: ContentItem) => {
    setEditId(item.id);
    setEditVersion(item.updatedAt || null);
    setFeedback(null);
    const next: FormData = { ...config.initial };
    for (const key of Object.keys(next)) {
      const value = item[key as keyof ContentItem];
      next[key] =
        key === "published"
          ? Boolean(value)
          : key === "order"
            ? Number(value || 0)
            : String(value ?? "");
    }
    if (kind === "events") {
      next.startDate = formatForInput(String(item.startDate || ""));
      next.endDate = item.endDate ? formatForInput(item.endDate) : "";
    }
    setForm(next);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>("input:not([readonly])")
        ?.focus({ preventScroll: true }),
    );
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(
        editId ? `/api/${kind}/${editId}` : `/api/${kind}`,
        {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", ...(editVersion ? { "If-Match": JSON.stringify(editVersion) } : {}) },
          body: JSON.stringify(form),
        },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Gagal menyimpan. Periksa isian dan coba kembali.");
      }
      setFeedback({
        type: "success",
        text: editId
          ? "Perubahan berhasil disimpan."
          : `${config.singular[0].toUpperCase() + config.singular.slice(1)} berhasil ditambahkan.`,
      });
      reset();
      await loadItems();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal menyimpan.",
      });
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget || mutating) return;
    setMutating(true);
    try {
      const res = await fetch(`/api/${kind}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error("Konten gagal dihapus. Silakan coba kembali.");
      if (editId === deleteTarget.id) reset();
      setDeleteTarget(null);
      setFeedback({ type: "success", text: "Konten berhasil dihapus." });
      await loadItems();
    } catch (error) {
      setDeleteTarget(null);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal menghapus.",
      });
    } finally {
      setMutating(false);
    }
  };
  const togglePublish = async (item: ContentItem) => {
    if (mutating) return;
    setMutating(true);
    try {
      const res = await fetch(`/api/news/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(item.updatedAt ? { "If-Match": JSON.stringify(item.updatedAt) } : {}) },
        body: JSON.stringify({ published: !item.published }),
      });
      if (!res.ok) throw new Error("Status publikasi gagal diubah.");
      setFeedback({
        type: "success",
        text: item.published
          ? "Berita dikembalikan ke draf."
          : "Berita berhasil dipublikasikan.",
      });
      await loadItems();
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Gagal memperbarui status.",
      });
    } finally {
      setMutating(false);
    }
  };
  const updateField = (field: Field, value: string) => {
    setForm((prev) => {
      if (kind === "news" && field.name === "title")
        return {
          ...prev,
          title: value,
          slug: editId
            ? prev.slug
            : value
                .toLowerCase()
                .replace(/ /g, "-")
                .replace(/[^\w-]+/g, ""),
        };
      return {
        ...prev,
        [field.name]:
          field.type === "number" ? parseInt(value || "0", 10) : value,
      };
    });
  };
  return (
    <>
      <div className="admin-heading">
        <div>
          <div className="eyebrow">
            <span />
            Content management
          </div>
          <h1>{config.title}</h1>
          <p>{config.intro}</p>
        </div>
        <span className="status-badge neutral">
          {loading ? "Memuat..." : `${items.length} ${config.singular}`}
        </span>
      </div>
      {feedback && (
        <div
          className={`feedback ${feedback.type}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.type === "success" && (
            <Check size={14} className="inline mr-2" />
          )}
          {feedback.text}
        </div>
      )}
      <section
        className="admin-panel"
        ref={formRef}
        style={{ scrollMarginTop: 24 }}
      >
        <div className="admin-panel-heading">
          <h2>
            {editId ? <Edit3 size={17} /> : <Plus size={17} />}{" "}
            {editId ? "Edit" : "Tambah"} {config.singular}
          </h2>
          <span>
            {editId
              ? "Perbarui informasi konten"
              : "Mulai dari konten yang ingin kamu bagikan"}
          </span>
        </div>
        <form className="admin-editor" onSubmit={save}>
          <fieldset disabled={saving} className="border-0 p-0 m-0 min-w-0">
            <div className="form-grid">
              {config.fields.map((field) => (
                <label
                  key={field.name}
                  className={`field ${field.full ? "full" : ""} ${field.name === "content" || field.name === "description" ? "content-field" : ""}`}
                >
                  <span>
                    {field.label}{" "}
                    {field.required && <span className="text-blue-600">*</span>}
                  </span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={String(form[field.name])}
                      onChange={(event) =>
                        updateField(field, event.target.value)
                      }
                      required={field.required}
                      rows={field.name === "bio" ? 3 : 8}
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      value={String(form[field.name])}
                      onChange={(event) =>
                        updateField(field, event.target.value)
                      }
                      required={field.required}
                      readOnly={kind === "news" && field.name === "slug"}
                      step={field.type === "number" ? 1 : undefined}
                    />
                  )}
                  {field.hint && <small>{field.hint}</small>}
                </label>
              ))}
              <ImageUpload
                value={String(form[config.imageKey])}
                onChange={(url) =>
                  setForm((prev) => ({ ...prev, [config.imageKey]: url }))
                }
                label={kind === "team" ? "Foto anggota" : "Gambar utama"}
                onBusy={setUploading}
                onError={(text) => setFeedback({ type: "error", text })}
              />
            </div>
            <div className="form-actions">
              {kind === "news" ? (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(form.published)}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        published: event.target.checked,
                      }))
                    }
                  />
                  Publikasikan ke website
                </label>
              ) : (
                <span className="small muted">* Wajib diisi</span>
              )}
              <div>
                {editId && (
                  <button
                    type="button"
                    onClick={reset}
                    className="button button-secondary"
                  >
                    <X size={14} />
                    Batal edit
                  </button>
                )}
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={saving || uploading}
                >
                  {saving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {saving
                    ? "Menyimpan..."
                    : editId
                      ? "Simpan perubahan"
                      : `Tambah ${config.singular}`}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{config.collection}</h2>
          <span>{items.length} konten</span>
        </div>
        {loadError ? (
          <div className="admin-table-empty">
            <p role="alert">{loadError}</p>
            <button
              onClick={loadItems}
              className="button button-secondary mt-4"
            >
              Coba lagi
            </button>
          </div>
        ) : loading ? (
          <div className="admin-table-empty" role="status">
            <Loader2 size={18} className="inline animate-spin mr-2" />
            Memuat data...
          </div>
        ) : items.length === 0 ? (
          <div className="admin-table-empty">
            Belum ada {config.singular}. Tambahkan melalui form di atas.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  {kind === "team" && <th>Urutan</th>}
                  <th>
                    {kind === "news"
                      ? "Artikel"
                      : kind === "events"
                        ? "Kegiatan"
                        : "Anggota"}
                  </th>
                  <th>
                    {kind === "news"
                      ? "Status"
                      : kind === "events"
                        ? "Jadwal & lokasi"
                        : "Jabatan"}
                  </th>
                  {kind === "news" && <th>Tanggal</th>}
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {kind === "team" && <td>#{item.order}</td>}
                    <td>
                      {kind === "team" ? (
                        <div className="member-cell">
                          <div className="upload-preview">
                            {item.photoUrl ? (
                              <Image
                                src={item.photoUrl}
                                alt=""
                                fill
                                unoptimized
                                sizes="38px"
                              />
                            ) : (
                              <User size={16} />
                            )}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <small>{item.bio}</small>
                          </div>
                        </div>
                      ) : (
                        <>
                          <strong>{item.title}</strong>
                          <small>
                            {kind === "news"
                              ? `/${item.slug}`
                              : item.description}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {kind === "news" ? (
                        <button
                          onClick={() => togglePublish(item)}
                          disabled={mutating}
                          className={`status-badge ${item.published ? "success" : "neutral"}`}
                          aria-label={`${item.published ? "Jadikan draf" : "Publikasikan"} ${item.title}`}
                        >
                          {item.published ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}
                          {item.published ? "Published" : "Draft"}
                        </button>
                      ) : kind === "events" ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            {new Date(item.startDate!).toLocaleDateString(
                              "id-ID",
                            )}
                          </span>
                          {item.location && (
                            <small>
                              <MapPin size={11} className="inline mr-1" />
                              {item.location}
                            </small>
                          )}
                        </>
                      ) : (
                        item.position
                      )}
                    </td>
                    {kind === "news" && (
                      <td>
                        {new Date(item.createdAt!).toLocaleDateString("id-ID")}
                      </td>
                    )}
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${item.title || item.name}`}
                          title="Edit"
                          disabled={saving || uploading || mutating}
                          onClick={() => edit(item)}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Hapus ${item.title || item.name}`}
                          title="Hapus"
                          disabled={saving || mutating}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        busy={mutating}
        title={`Hapus ${config.singular}?`}
      >
        <p>
          <strong>{deleteTarget?.title || deleteTarget?.name}</strong> akan
          dihapus dari daftar. Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={mutating}
            onClick={() => setDeleteTarget(null)}
          >
            Batal
          </button>
          <button
            className="button button-danger"
            disabled={mutating}
            onClick={remove}
          >
            {mutating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            Hapus {config.singular}
          </button>
        </div>
      </Dialog>
    </>
  );
}
