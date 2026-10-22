import Image from "next/image";
import { useState, useRef, useEffect, useId, type ReactNode } from "react";
import { Message, ChatMode } from "@/types";
import {
  User,
  Volume2,
  Copy,
  RotateCw,
  Check,
  Pencil,
  Save,
  Code,
  Eye,
  FileText,
  MessageCircle,
  Maximize2,
} from "lucide-react";
import MediaViewer from "@/components/shared/MediaViewer";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";

type CodeBlockProps = {
  className?: string;
  children?: ReactNode;
};

const CodeBlock = ({ className, children }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeContent = String(children).replace(/\n$/, "");

  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setIsCopied(false);
    }
  };

  if (!match) {
    return (
      <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-[13px] font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="code-panel rounded-md overflow-hidden my-4 border border-slate-200 shadow-sm bg-slate-900">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-300 lowercase font-mono">
            {language}
          </span>

          {language === "html" && (
            <div className="flex bg-slate-900/50 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode("code")}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === "code" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Code className="w-3 h-3" /> Code
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === "preview" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
              >
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white transition-colors"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{isCopied ? "Disalin!" : "Salin Code"}</span>
        </button>
      </div>

      {viewMode === "preview" && language === "html" ? (
        <div className="bg-white h-auto min-h-[200px] border-b border-slate-100 relative">
          <div className="absolute top-0 left-0 right-0 h-6 bg-slate-100 flex items-center px-2 gap-1 border-b border-slate-200">
            <div className="w-2 h-2 rounded-full bg-red-400/50"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-400/50"></div>
            <div className="w-2 h-2 rounded-full bg-green-400/50"></div>
            <span className="ml-2 text-[10px] text-slate-400">
              Browser Preview
            </span>
          </div>
          <iframe
            srcDoc={codeContent}
            className="w-full h-full min-h-[300px] pt-6"
            title="Preview"
            sandbox="allow-scripts"
          />
        </div>
      ) : (
        <div className="max-h-[500px] overflow-auto custom-scrollbar">
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: "13px",
              backgroundColor: "#0f172a",
            }}
          >
            {codeContent}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

const Mermaid = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const mermaidId = `mermaid-${useId().replace(/:/g, "")}`;

  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return;
      try {
        setError(false);
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          flowchart: { htmlLabels: false },
          fontFamily: "inherit",
        });

        const { svg } = await mermaid.render(mermaidId, chart);
        setSvg(svg);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(true);
      }
    };
    const timeout = setTimeout(renderChart, 100);
    return () => clearTimeout(timeout);
  }, [chart, mermaidId]);

  const openViewer = () => setIsOpen(true);
  if (error) {
    return (
      <div className="my-4 flex flex-col gap-2">
        <div className="p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md font-medium">
          ⚠️ Gagal merender diagram. Kode sumber:
        </div>
        <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 text-xs text-slate-400 italic animate-pulse">
        Memproses diagram...
      </div>
    );
  }

  return (
    <>
      <div
        className="my-4 border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow cursor-pointer group relative"
        onClick={openViewer}
        role="button"
        tabIndex={0}
        aria-label="Buka diagram"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openViewer();
          }
        }}
      >
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium flex items-center gap-1.5">
            Flowchart
          </span>
          <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            Zoom
          </span>
        </div>

        <div className="relative max-h-[250px] overflow-hidden bg-slate-50/30">
          <div
            className="p-6 flex justify-center opacity-80 group-hover:opacity-100 transition-opacity scale-90 origin-top"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <span className="bg-white text-blue-600 px-4 py-2 rounded-full shadow-lg border border-blue-100 text-sm font-bold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
              <Maximize2 className="w-4 h-4" /> Fullscreen
            </span>
          </div>
        </div>
      </div>

      {isOpen && (
        <MediaViewer
          title="Viewer diagram"
          onClose={() => setIsOpen(false)}
          svg={svg}
        />
      )}
    </>
  );
};

const ImageViewer = ({ src, alt }: { src: string; alt?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!src) return null;
  return (
    <span className="my-4 inline-block max-w-full">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-w-full cursor-zoom-in"
        aria-label="Buka gambar"
      >
        <Image
          src={src}
          alt={alt || "Gambar AET AI"}
          width={1200}
          height={800}
          unoptimized
          className="max-w-full h-auto object-contain max-h-[400px]"
        />
      </button>
      {isOpen && (
        <MediaViewer
          title="Viewer gambar"
          onClose={() => setIsOpen(false)}
          src={src}
          alt={alt}
        />
      )}
    </span>
  );
};

const VideoViewer = ({ src }: { src: string }) => {
  const downloadFileName = "aet_ai-video.mp4";

  return (
    <div className="my-4 max-w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm relative group/video">
      <video controls className="w-full h-auto max-h-[400px]" src={src}>
        Browser tidak mendukung video tag.
      </video>
      <div className="absolute top-2 right-2 opacity-0 group-hover/video:opacity-100 transition-opacity">
        <a
          href={src}
          download={downloadFileName}
          className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs rounded-full backdrop-blur-md transition-colors border border-white/10"
        >
          <Save className="w-3.5 h-3.5" /> Simpan
        </a>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  mode?: ChatMode;
  onRetry?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onSave?: (id: string, newContent: string) => void;
  onCancel?: () => void;
  isEditable?: boolean;
  isEditing?: boolean;
  isLast?: boolean;
}

export default function MessageBubble({
  message,
  mode = "daily",
  onRetry,
  onEdit,
  onSave,
  onCancel,
  isEditable,
  isEditing,
  isLast,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isCopied, setIsCopied] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [editedText, setEditedText] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      const timeout = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [isEditing]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    },
    [],
  );

  const handleRead = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      if (isReading) {
        setIsReading(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.lang = "id-ID";
      utterance.rate = 1;

      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);

      setIsReading(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin:", err);
    }
  };

  const handleSaveClick = () => {
    if (onSave && editedText.trim() !== "") {
      onSave(message.id, editedText);
    }
  };

  const handleEditClick = () => {
    setEditedText(message.content);
    onEdit?.(message);
  };

  const handleCancelEdit = () => {
    setEditedText(message.content);
    onCancel?.();
  };

  const modeGradients: Record<string, string> = {
    coding: "from-[#16274A] to-[#16274A]",
    report: "from-[#146C52] to-[#146C52]",
    daily: "from-[#0056D2] to-[#0056D2]",
  };
  const modeGradient = modeGradients[mode] || "from-blue-600 to-indigo-600";

  return (
    <div
      className={`message-row flex ${isUser ? "user-row flex-row-reverse" : "assistant-row flex-row"} group`}
    >
      {/* Avatar */}
      <div
        className={`message-avatar flex-shrink-0 flex items-center justify-center
        ${isUser ? "bg-slate-200" : `bg-gradient-to-br ${modeGradient}`}`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-slate-500" />
        ) : mode === "coding" ? (
          <Code className="w-4 h-4 text-white" />
        ) : mode === "report" ? (
          <FileText className="w-4 h-4 text-white" />
        ) : (
          <MessageCircle className="w-4 h-4 text-white" />
        )}
      </div>

      <div
        className={`message-column flex flex-col ${isEditing ? "w-full" : ""}`}
      >
        <div
          className={`message-surface ${isUser ? "user-bubble" : "assistant-surface"}`}
        >
          {message.attachment && (
            <div className="mb-3">
              {message.attachment.content ? (
                message.attachment.type === "image" ? (
                  <div className="max-w-sm">
                    <ImageViewer
                      src={message.attachment.content}
                      alt={message.attachment.fileName}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl max-w-sm hover:bg-slate-100 transition-colors group/file">
                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex items-center justify-center shadow-sm text-blue-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-slate-700 truncate"
                        title={message.attachment.fileName}
                      >
                        {message.attachment.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase">
                        {message.attachment.fileName.split(".").pop()} File
                      </p>
                    </div>
                    <a
                      href={message.attachment.content}
                      download={message.attachment.fileName}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Save className="w-4 h-4" />
                    </a>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl max-w-sm">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500 truncate">
                    {message.attachment.fileName}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    ({message.attachment.type === "image" ? "Gambar" : "File"})
                  </span>
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-3 w-full min-w-0">
              <textarea
                ref={textareaRef}
                aria-label="Edit pesan"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className={`w-full p-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-opacity-50
                  ${
                    isUser
                      ? "bg-white text-slate-800 focus:ring-blue-500 border border-blue-200"
                      : "bg-slate-50 text-slate-800 focus:ring-blue-500 border border-slate-200"
                  }`}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${
                      isUser
                        ? "border-blue-200 hover:bg-blue-100 text-blue-700"
                        : "border-slate-200 hover:bg-slate-100 text-slate-600"
                    }`}
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveClick}
                  disabled={!editedText.trim()}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95
                    ${
                      isUser
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                  <Save className="w-3 h-3" />
                  Simpan & Kirim
                </button>
              </div>
            </div>
          ) : (
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                urlTransform={(value) => value}
                components={{
                  pre: ({ children }) => <>{children}</>,
                  img: ({ src, alt }) => {
                    return <ImageViewer src={src as string} alt={alt} />;
                  },
                  code: ({ className, children }) => {
                    const match = /language-(\w+)/.exec(className || "");
                    const language = match ? match[1].trim() : "";
                    const content = String(children).replace(/\n$/, "");

                    if (language === "mermaid") {
                      return <Mermaid chart={content} />;
                    }

                    return (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    );
                  },
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-3 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-3 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="pl-1">{children}</li>,
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0 whitespace-pre-line">
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <span className="font-bold opacity-90">{children}</span>
                  ),
                  a: ({ href, children }) => {
                    if (!href) return null;
                    const isVideo =
                      href.startsWith("data:video") || href.endsWith(".mp4");

                    if (isVideo) {
                      return <VideoViewer src={href} />;
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        {children}
                      </a>
                    );
                  },
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mb-2 mt-4 pb-2 border-b border-white/20">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mb-2 mt-4">
                      {children}
                    </h2>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      className={`border-l-4 pl-4 py-1 my-3 italic ${isUser ? "border-white/30 bg-blue-700/30" : "border-blue-500 bg-blue-50 text-slate-600"}`}
                    >
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 whitespace-nowrap text-sm border-b border-slate-100">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {!isEditing && (
            <>
              <div
                className={`message-divider h-px w-full my-3 ${isUser ? "bg-white/15" : "bg-slate-100"}`}
              />
              <div
                className={`message-actions flex items-center font-semibold
                ${isUser ? "justify-end" : ""}`}
              >
                {isUser ? (
                  <>
                    {isEditable && (
                      <button
                        onClick={handleEditClick}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-white/20 hover:text-white transition-all duration-150 active:scale-95"
                        title="Edit Pesan"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-white/20 hover:text-white transition-all duration-150 active:scale-95"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{isCopied ? "Tersalin" : "Salin"}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleRead}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all duration-150 active:scale-95
                        ${isReading ? "text-blue-600 bg-blue-50 font-bold" : "hover:bg-slate-100 hover:text-blue-600"}`}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>{isReading ? "Stop" : "Baca"}</span>
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 hover:text-blue-600 transition-all duration-150 active:scale-95"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{isCopied ? "Tersalin" : "Salin"}</span>
                    </button>
                    {isLast && onRetry && (
                      <button
                        onClick={() => onRetry?.(message)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 hover:text-blue-600 transition-all duration-150 active:scale-95"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Ulangi</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <details className="text-xs text-slate-600 border-t border-slate-200 mt-3 pt-2">
            <summary className="cursor-pointer font-medium">Sumber dan pemeriksaan ({message.sources.length})</summary>
            <ul className="mt-2 space-y-2 list-none pl-0">
              {message.sources.map((source, index) => (
                <li key={`${source.kind}-${index}`}>
                  {source.url && /^https:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title}</a> : <span>{source.title}</span>}
                  <span> · {source.status === 'ok' ? 'Diperoleh pada permintaan ini' : 'Tidak berhasil diperoleh'}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {message.status && message.status !== "complete" && <p className="text-xs text-amber-700 px-1" role="status">{message.status === "streaming" ? "Sedang menulis…" : message.status === "cancelled" ? "Dihentikan · jawaban belum lengkap" : "Jawaban belum selesai · coba ulang"}</p>}
        <div
          className={`flex items-center gap-1.5 px-1 mt-0.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="message-timestamp font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {new Date(message.timestamp).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
