"use client";

import NextImage from "next/image";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import { Message, ChatMode } from "@/types";
import {
  AET_FRONTIER_QUESTIONS,
  AI_MODELS,
  isFrontierModel,
  type AetFrontierQuestionId,
  type AiModel,
} from "@/lib/ai-models";
import MessageBubble from "./MessageBubble";
import { createId } from "@/lib/ids";
import { historicalModelLabel, isAvailableModel } from "@/lib/ai-models";
import { readChatEvents } from "@/lib/chat-stream";
import { loadConversationStore, newConversation, persistConversationStore, saveCurrentSnapshot, deleteStoredConversation, savedConversations, historyForModel, retryHistory, type Conversation, type ConversationStore } from "@/lib/conversations";
import { RequestLifecycle } from "@/lib/request-lifecycle";
import { SkeletonMessage } from "@/components/ui/SkeletonCard";
import {
  Camera,
  Paperclip,
  X,
  Send,
  Loader2,
  Trash2,
  ArrowLeft,
  FileText,
  Code,
  MessageCircle,
  ChevronDown,
  ArrowDown,
  ArrowUpRight,
  Check,
  Bot,
  KeyRound,
  Home,
  Newspaper,
  Plus,
  Square,
  History,
} from "lucide-react";
import Link from "next/link";
import Brand from "@/components/layout/Brand";
import Dialog from "@/components/shared/Dialog";

interface ChatInterfaceProps {
  mode: ChatMode;
  modeTitle: string;
  onBack: () => void;
}

const FRONTIER_ACCESS_STORAGE_KEY = "aet_ai_frontier_access_token";

const createEmptyFrontierAnswers = (): Record<AetFrontierQuestionId, string> =>
  Object.fromEntries(
    AET_FRONTIER_QUESTIONS.map((question) => [question.id, ""]),
  ) as Record<AetFrontierQuestionId, string>;

export default function ChatInterface({
  mode,
  modeTitle,
  onBack,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{
    content: string;
    mimeType: string;
    type: "image" | "file";
    fileName: string;
    extractedText?: string;
  } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [frontierAccessToken, setFrontierAccessToken] = useState<string | null>(
    null,
  );
  const [frontierTargetModel, setFrontierTargetModel] =
    useState<AiModel | null>(null);
  const [frontierAnswers, setFrontierAnswers] = useState<
    Record<AetFrontierQuestionId, string>
  >(createEmptyFrontierAnswers);
  const [isFrontierModalOpen, setIsFrontierModalOpen] = useState(false);
  const [isVerifyingFrontier, setIsVerifyingFrontier] = useState(false);
  const [frontierError, setFrontierError] = useState("");
  const [isAttachmentLoading, setIsAttachmentLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPosition, setModelPosition] = useState({ left: 16, bottom: 150 });
  const [storageError, setStorageError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [contextNotice, setContextNotice] = useState("");
  const [conversationStore, setConversationStore] = useState<ConversationStore | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const requests = useRef(new RequestLifecycle());
  const attachmentRequests = useRef(new RequestLifecycle());
  const storeRef = useRef<ConversationStore | null>(null);
  const saveAllowedRef = useRef(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const modelsRef = useRef<HTMLDivElement>(null);
  const modelsBtnRef = useRef<HTMLButtonElement>(null);


  // === Mode Config ===
  const MODE_CONFIG = {
    coding: {
      icon: Code,
      gradient: "from-blue-600 to-indigo-600",
      bg: "bg-blue-100",
      text: "text-blue-600",
      shadow: "shadow-blue-200",
    },
    report: {
      icon: FileText,
      gradient: "from-emerald-600 to-teal-600",
      bg: "bg-emerald-100",
      text: "text-emerald-600",
      shadow: "shadow-emerald-200",
    },
    daily: {
      icon: MessageCircle,
      gradient: "from-violet-600 to-purple-600",
      bg: "bg-violet-100",
      text: "text-violet-600",
      shadow: "shadow-violet-200",
    },
  };
  const currentMode = MODE_CONFIG[mode];
  const ModeIcon = currentMode.icon;

  // === Available Models ===
  const models = AI_MODELS;

  const activeModel = models.find((m) => m.id === selectedModel);
  const modelName = historicalModelLabel(selectedModel);
  const hasFrontierAccess = Boolean(frontierAccessToken);

  useEffect(() => {
    if (!isModelOpen) return;
    const close = () => setIsModelOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [isModelOpen]);

  const greetingMessages = useCallback((): Message[] => {
    const greetingMap: Record<ChatMode, string> = {
      daily:
        "Halo! 👋 Saya AET AI — teman cerdasmu di AET PCR. Mau tanya apa hari ini?",
      report:
        "Halo! 📝 Saya AET AI, siap membantu penulisan akademik Anda — dari struktur laporan hingga analisis data. Silakan mulai.",
      coding:
        "Halo! 💻 Saya AET AI — siap bantu coding, debugging, dan penjelasan konsep teknis. Tempel kode atau tanya apa saja!",
    };
    return [
      {
        id: createId(),
        role: "assistant",
        content: greetingMap[mode],
        timestamp: new Date(),
      },
    ];
  }, [mode]);

  // === Click Outside Close Dropdowns ===
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isModelOpen &&
        modelsRef.current &&
        !modelsRef.current.contains(target) &&
        !modelsBtnRef.current?.contains(target)
      ) {
        setIsModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModelOpen]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const savedToken = localStorage.getItem(FRONTIER_ACCESS_STORAGE_KEY);
        if (savedToken) setFrontierAccessToken(savedToken);
      } catch {
        /* Access remains locked. */
      }
    });
    return () => { active = false; };
  }, []);

  // === Scroll to bottom ===
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // === Show/hide scroll to bottom button ===
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const cancelPending = useCallback(() => { requests.current.cancel(); attachmentRequests.current.cancel(); }, []);

  // Migration preserves the original per-mode key. Corrupt stores are never overwritten.
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      let store: ConversationStore;
      saveAllowedRef.current = true;
      setStorageError("");
      setIsLoading(false); setIsAttachmentLoading(false);
      setInput(""); setAttachment(null); setEditingMessageId(null);
      setRequestError(""); setContextNotice(""); setDeleteTargetId(null);
      setHistoryOpen(false); setRenameOpen(false);
      try { store = loadConversationStore(localStorage, mode); }
      catch {
        saveAllowedRef.current = false;
        setStorageError("Riwayat tidak dapat dibaca. Data asli tetap tersimpan; percakapan sesi ini belum disimpan.");
        const chat = newConversation(mode);
        store = { version: 2, activeId: chat.id, conversations: [chat] };
      }
      const active = store.conversations.find(c => c.id === store.activeId)!;
      if (!active.messages.length) active.messages = greetingMessages();
      storeRef.current = store;
      setConversationStore(store);
      setMessages(active.messages);
      setSelectedModel(active.modelId);
    });
    return () => { mounted = false; cancelPending(); };
  }, [mode, greetingMessages, cancelPending]);

  useEffect(() => {
    const current = storeRef.current;
    if (!current || !messages.length || current.conversations.some(c => c.mode !== mode)) return;
    const next = { ...current, conversations: current.conversations.map(c => c.id === current.activeId ? { ...c, messages, modelId: selectedModel, title: c.title === "Percakapan baru" && messages.some(m => m.role === "user") ? messages.find(m => m.role === "user")!.content.slice(0, 50) || "Percakapan dengan lampiran" : c.title, updatedAt: new Date().toISOString() } : c) };
    storeRef.current = next;
    setConversationStore(next);
    const save = () => {
      if (!saveAllowedRef.current) return;
      try { if (saveCurrentSnapshot(localStorage, mode, next, storeRef.current)) setStorageError(""); }
      catch { setStorageError("Penyimpanan browser penuh atau tidak tersedia. Riwayat terbaru belum dapat disimpan."); }
    };
    const timer = setTimeout(save, 250);
    const flush = () => save();
    window.addEventListener("pagehide", flush);
    return () => { clearTimeout(timer); save(); window.removeEventListener("pagehide", flush); };
  }, [messages, selectedModel, mode]);

  const publishStore = (store: ConversationStore) => {
    storeRef.current = store;
    setConversationStore(store);
  };
  const persistStore = (store: ConversationStore) => {
    publishStore(store);
    if (!saveAllowedRef.current) return;
    try { persistConversationStore(localStorage, mode, store); setStorageError(""); }
    catch { setStorageError("Perubahan riwayat belum dapat disimpan di browser."); }
  };
  const displayConversation = (chat: Conversation) => {
    cancelPending();
    setIsAttachmentLoading(false); setIsLoading(false);
    setRequestError(""); setContextNotice(""); setInput("");
    setAttachment(null); setEditingMessageId(null);
    setMessages(chat.messages.length ? chat.messages : greetingMessages());
    setSelectedModel(chat.modelId); setHistoryOpen(false);
  };
  const activateConversation = (chat: Conversation, store = storeRef.current!) => {
    persistStore({ ...store, activeId: chat.id });
    displayConversation(chat);
  };
  const createConversation = () => {
    if (!storeRef.current) return;
    const chat = newConversation(mode, greetingMessages());
    activateConversation(chat, { ...storeRef.current, conversations: [chat, ...savedConversations(storeRef.current)] });
  };
  const requestDeleteConversation = (id: string) => {
    setHistoryOpen(false);
    setDeleteTargetId(id);
  };
  const confirmDeleteConversation = () => {
    const current = storeRef.current;
    if (!current || !deleteTargetId) return;
    if (!saveAllowedRef.current) {
      setStorageError("Penghapusan belum disimpan karena riwayat browser tidak dapat dibaca. Data asli tetap dipertahankan.");
      return;
    }
    if (deleteTargetId === current.activeId) {
      cancelPending();
      setIsLoading(false); setIsAttachmentLoading(false); setAttachment(null);
      // Cancellation remains truthful even when the subsequent durable write fails.
      setMessages(previous => previous.map(m => m.status === "streaming" ? { ...m, status: "cancelled" } : m));
    }
    try {
      const next = deleteStoredConversation(localStorage, mode, current, deleteTargetId);
      publishStore(next);
      if (deleteTargetId === current.activeId) displayConversation(next.conversations.find(c => c.id === next.activeId)!);
      setStorageError(""); setDeleteTargetId(null);
    } catch {
      setStorageError("Penghapusan belum dapat disimpan di browser. Percakapan belum dihapus dari daftar; coba lagi saat penyimpanan tersedia.");
    }
  };

  // === Auto-resize textarea ===
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Abort and request IDs prevent late replies from modifying a different conversation.
  const processMessageToAI = async (currentHistory: Message[]) => {
    if (requests.current.pending) return;
    if (!isAvailableModel(selectedModel)) { setRequestError("Model percakapan ini tidak lagi aktif. Pilih model lain untuk melanjutkan."); return; }
    const apiMessages = historyForModel(currentHistory);
    if (!apiMessages.length) return;
    const ticket = requests.current.begin();
    const { controller } = ticket;
    const timeout = setTimeout(() => controller.abort("timeout"), 70000);
    const assistantId = createId();
    let started = false;
    let content = "";
    setIsLoading(true); setRequestError(""); setContextNotice("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: apiMessages.slice(-200), mode, model: selectedModel, frontierAccessToken: isFrontierModel(selectedModel) ? frontierAccessToken : undefined }),
      });
      if (!requests.current.canApply(ticket)) { await response.body?.cancel(); return; }
      if (!response.ok) {
        if (response.status === 403 && isFrontierModel(selectedModel)) {
          try { localStorage.removeItem(FRONTIER_ACCESS_STORAGE_KEY); } catch { /* optional storage */ }
          setFrontierAccessToken(null);
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Permintaan tidak dapat diproses.");
      }
      if (!requests.current.owns(ticket)) return;
      started = true;
      setMessages(prev => requests.current.owns(ticket) ? [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date(), modelId: selectedModel, status: "streaming" }] : prev);
      const append = (delta: string) => {
        content += delta;
        if (requests.current.canApply(ticket)) setMessages(prev => prev.map(m => requests.current.owns(ticket) && m.id === assistantId ? { ...m, content } : m));
      };
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        for await (const event of readChatEvents(response, controller.signal)) {
          if (event.event === "delta") append(String(event.data.text || ""));
          if (event.event === "meta" && Array.isArray(event.data.sources) && requests.current.canApply(ticket)) setMessages(prev => prev.map(m => requests.current.owns(ticket) && m.id === assistantId ? { ...m, sources: event.data.sources as Message['sources'] } : m));
          if (event.event === "meta" && event.data.contextTruncated && requests.current.canApply(ticket)) setContextNotice("Sebagian riwayat lama tidak dikirim karena batas konteks. Riwayat lengkap tetap tersimpan di browser.");
        }
      } else if (response.headers.get("content-type")?.includes("application/json")) {
        const data = await response.json(); if (!data.response) throw new Error("Respons model kosong."); append(data.response);
      } else {
        if (!response.body) throw new Error("Stream respons tidak tersedia.");
        const reader = response.body.getReader(); const decoder = new TextDecoder();
        try { while (true) { const { done, value } = await reader.read(); if (done) break; append(decoder.decode(value, { stream: true })); } append(decoder.decode()); }
        finally { reader.releaseLock(); }
      }
      controller.signal.throwIfAborted();
      if (!content.trim()) throw new Error("Model tidak menghasilkan jawaban teks.");
      if (requests.current.canApply(ticket)) setMessages(prev => prev.map(m => requests.current.owns(ticket) && m.id === assistantId ? { ...m, status: "complete" } : m));
    } catch (error) {
      if (!requests.current.owns(ticket)) return;
      const cancelled = controller.signal.aborted;
      setRequestError(cancelled ? controller.signal.reason === "timeout" ? "Waktu tunggu habis. Coba ulang." : "Jawaban dihentikan. Kamu dapat mencoba ulang." : error instanceof Error ? error.message : "Respons gagal.");
      if (started) setMessages(prev => prev.map(m => requests.current.owns(ticket) && m.id === assistantId ? { ...m, status: cancelled ? "cancelled" : "error" } : m));
    } finally {
      clearTimeout(timeout);
      if (requests.current.owns(ticket)) { setIsLoading(false); inputRef.current?.focus(); }
      requests.current.finish(ticket);
    }
  };

  // File decoding obeys the same cancellation/timeout as the upload request.
  const fileToBase64 = (file: File, signal: AbortSignal): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      const cleanup = () => signal.removeEventListener("abort", abort);
      const abort = () => { cleanup(); reader.abort(); reject(signal.reason); };
      if (signal.aborted) { reject(signal.reason); return; }
      signal.addEventListener("abort", abort, { once: true });
      reader.onload = () => { cleanup(); resolve(String(reader.result)); };
      reader.onerror = () => { cleanup(); reject(new Error("File tidak dapat dibaca.")); };
      reader.readAsDataURL(file);
    });

  const compressImage = async (file: File, signal: AbortSignal): Promise<string> => {
    const data = await fileToBase64(file, signal);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const cleanup = () => { signal.removeEventListener("abort", abort); img.onload = null; img.onerror = null; };
      const abort = () => { cleanup(); img.src = ""; reject(signal.reason); };
      if (signal.aborted) { reject(signal.reason); return; }
      signal.addEventListener("abort", abort, { once: true });
      img.onerror = () => { cleanup(); reject(new Error("Gambar tidak dapat dibaca.")); };
      img.onload = () => {
        try {
          if (!img.width || !img.height) throw new Error("Ukuran gambar tidak valid.");
          const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Pratinjau gambar tidak tersedia.");
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          const result = canvas.toDataURL("image/jpeg", 0.75);
          cleanup(); resolve(result);
        } catch (error) { cleanup(); reject(error); }
      };
      img.src = data;
    });
  };

  // === File Handler ===
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ticket = attachmentRequests.current.begin();
    const { controller } = ticket;
    const fileInput = e.target;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setIsAttachmentLoading(true); setAttachment(null);
    try {
      if (file.name.length > 200) throw new Error("Nama lampiran maksimal 200 karakter.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Lampiran maksimal 5 MB.");
      const fileTypes: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };
      let mimeType = file.type || fileTypes[file.name.split(".").at(-1)?.toLowerCase() || ""] || "";
      let base64Content = "";
      let extractedText: string | undefined;
      if (mimeType.startsWith("image/")) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("Gunakan gambar PNG, JPEG, atau WebP.");
        if (activeModel?.supportsImageInput !== true) throw new Error("Analisis gambar belum terverifikasi pada model ini. Gunakan PDF, DOCX, TXT, atau jelaskan isi gambar.");
        base64Content = await compressImage(file, controller.signal); mimeType = "image/jpeg";
      } else {
        const response = await fetch("/api/attachments", { method: "POST", signal: controller.signal, headers: { "Content-Type": mimeType }, body: file });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Dokumen tidak dapat dibaca.");
        extractedText = data.text;
        // Keep the original only in memory for preview/download, never localStorage.
        base64Content = await fileToBase64(file, controller.signal);
        if (data.truncated && attachmentRequests.current.canApply(ticket)) setContextNotice("Teks dokumen dibatasi pada 24.000 karakter pertama.");
      }

      if (!attachmentRequests.current.canApply(ticket)) return;
      setAttachment(previous => attachmentRequests.current.canApply(ticket) ? {
        content: base64Content,
        mimeType,
        type: mimeType.startsWith("image/") ? "image" : "file",
        fileName: file.name,
        extractedText,
      } : previous);
    } catch (error) {
      if (attachmentRequests.current.owns(ticket)) setRequestError(controller.signal.aborted ? "Pemrosesan lampiran melewati batas waktu. Coba unggah kembali." : error instanceof Error ? error.message : "Gagal memproses file.");
    } finally {
      clearTimeout(timeout);
      if (attachmentRequests.current.owns(ticket)) setIsAttachmentLoading(false);
      attachmentRequests.current.finish(ticket);
      fileInput.value = "";
    }
  };

  const handleModelSelect = (model: AiModel) => {
    if (model.availability !== "available") return;
    if (model.isFrontier && !hasFrontierAccess) {
      setIsModelOpen(false);
      setFrontierTargetModel(model);
      setFrontierAnswers(createEmptyFrontierAnswers());
      setFrontierError("");
      setIsFrontierModalOpen(true);
      return;
    }

    setSelectedModel(model.id);
    setIsModelOpen(false);
  };

  const handleFrontierAnswerChange = (
    questionId: AetFrontierQuestionId,
    value: string,
  ) => {
    setFrontierAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleFrontierSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!frontierTargetModel || isVerifyingFrontier) return;

    setIsVerifyingFrontier(true);
    setFrontierError("");

    try {
      const response = await fetch("/api/frontier-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: frontierAnswers }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.token) {
        throw new Error(
          data.error || "Jawaban belum benar. Coba cek lagi data AET kamu.",
        );
      }

      try { localStorage.setItem(FRONTIER_ACCESS_STORAGE_KEY, data.token); } catch { /* access remains usable in this session */ }
      setFrontierAccessToken(data.token);
      setSelectedModel(frontierTargetModel.id);
      setIsFrontierModalOpen(false);
      setIsModelOpen(false);
      setFrontierTargetModel(null);
      setFrontierAnswers(createEmptyFrontierAnswers());
    } catch (error: unknown) {
      const err = error as Error;
      setFrontierError(err.message);
    } finally {
      setIsVerifyingFrontier(false);
    }
  };

  // === Send Message ===
  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading || isAttachmentLoading || !isAvailableModel(selectedModel) || !storeRef.current)
      return;
    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      attachment: attachment ? { ...attachment } : undefined,
      status: "complete",
    };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setAttachment(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    await processMessageToAI(newHistory);
  };

  const handleReload = async () => {
    if (requests.current.pending || messages.length === 0) return;
    const history = retryHistory(messages);
    setMessages(history);
    await processMessageToAI(history);
  };

  const handleEditStart = (message: Message) => setEditingMessageId(message.id);
  const handleEditCancel = () => setEditingMessageId(null);

  const handleEditSave = async (id: string, newContent: string) => {
    if (requests.current.pending) return;
    setEditingMessageId(null);
    const index = messages.findIndex((m) => m.id === id);
    if (index === -1) return;
    const newHistory = messages.slice(0, index + 1);
    newHistory[index] = { ...newHistory[index], content: newContent };
    setMessages(newHistory);
    await processMessageToAI(newHistory);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const canSend =
    (input.trim() || !!attachment) && !isLoading && !isAttachmentLoading && isAvailableModel(selectedModel) && Boolean(conversationStore);
  const isStreamingAssistant =
    isLoading && messages[messages.length - 1]?.role === "assistant";
  const canVerifyFrontier =
    AET_FRONTIER_QUESTIONS.every((question) =>
      frontierAnswers[question.id].trim(),
    ) && !isVerifyingFrontier;

  const suggestions: Record<ChatMode, string[]> = {
    daily: [
      "Bantu susun rencana belajar minggu ini",
      "Diskusikan ide proyek teknologi",
      "Jelaskan konsep yang ingin saya pelajari",
    ],
    report: [
      "Bantu susun kerangka laporan penelitian",
      "Tinjau alur argumentasi tulisan saya",
      "Jelaskan cara menganalisis data penelitian",
    ],
    coding: [
      "Bantu telusuri bug pada kode saya",
      "Jelaskan konsep pointer di C++",
      "Buat contoh pembacaan sensor dengan Python",
    ],
  };
  const historyConversations = conversationStore ? savedConversations(conversationStore).filter(c => `${c.title} ${c.messages.map(m => m.content).join(" ")}`.toLowerCase().includes(conversationSearch.toLowerCase())) : [];
  const deleteTarget = conversationStore?.conversations.find(c => c.id === deleteTargetId);
  const hasSavedActive = Boolean(conversationStore && savedConversations(conversationStore).some(c => c.id === conversationStore.activeId));
  const filteredModels = models.filter((model) =>
    `${model.name} ${model.provider} ${model.tier}`
      .toLowerCase()
      .includes(modelSearch.toLowerCase()),
  );
  const openModelPicker = () => {
    const rect = modelsBtnRef.current?.getBoundingClientRect();
    if (rect)
      setModelPosition({
        left: Math.max(16, Math.min(rect.right - 360, window.innerWidth - 376)),
        bottom: window.innerHeight - rect.top + 10,
      });
    setModelSearch("");
    setIsModelOpen((value) => !value);
  };

  return (
    <div className="chat-shell">
      <aside className="chat-rail" aria-label="Navigasi workspace">
        <Brand />
        <p className="rail-label">Workspace kamu</p>
        <div className="rail-mode">
          <ModeIcon size={18} />
          <div>
            <strong>{modeTitle}</strong>
            <small>Riwayat mode ini</small>
          </div>
        </div>
        <p className="rail-note">
          Satu ruang untuk melanjutkan ide. Riwayat setiap mode disimpan di
          browser ini.
        </p>
        <button className="button button-primary" onClick={createConversation} disabled={!conversationStore}><Plus size={15} /> Percakapan baru</button>
        <input className="conversation-search" value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} placeholder="Cari percakapan..." aria-label="Cari percakapan" />
        <div className="conversation-list">
          {historyConversations.map(c => <div key={c.id} className="conversation-item">
            <button className={c.id === conversationStore?.activeId ? "active" : ""} aria-current={c.id === conversationStore?.activeId ? "true" : undefined} onClick={() => activateConversation(c)}>{c.title}</button>
            <button className="conversation-delete" aria-label={`Hapus percakapan ${c.title}`} title={`Hapus ${c.title}`} onClick={() => requestDeleteConversation(c.id)}><Trash2 size={14} /></button>
          </div>)}
        </div>
        <div className="rail-tools">
          <button onClick={onBack}>
            <Home size={16} />
            Kembali ke beranda
          </button>
          <Link href="/news">
            <Newspaper size={16} />
            Kabar dari AET
          </Link>
          <Link href="/team">
            <ArrowUpRight size={16} />
            Kenali tim AET PCR
          </Link>
        </div>
      </aside>
      <main className="chat-workspace" id="main-content">
        <header className="chat-header">
          <div className="chat-header-left">
            <button
              onClick={onBack}
              className="icon-button"
              aria-label="Kembali ke beranda"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <h1>{modeTitle}</h1>
              <p role="status">
                <span className="chat-status" />
                {isLoading
                  ? "Sedang menyusun jawaban..."
                  : "AET AI / Ruang percakapan"}
              </p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button onClick={() => setHistoryOpen(true)} className="icon-button" aria-label="Daftar percakapan"><History size={17} /></button>
            <button onClick={createConversation} className="icon-button" disabled={!conversationStore} aria-label="Percakapan baru"><Plus size={17} /></button>
            <span className="chat-model-badge">
              <Bot size={13} />
              {modelName}
            </span>
            <button
              onClick={() => conversationStore && requestDeleteConversation(conversationStore.activeId)}
              className="icon-button danger"
              disabled={!hasSavedActive}
              title="Hapus percakapan"
              aria-label="Hapus percakapan"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </header>
        <div
          ref={messagesContainerRef}
          className="chat-messages custom-scrollbar"
          aria-label="Percakapan"
        >
          <div className="chat-reading">
            {messages.filter((message) => message.role === "user").length ===
              0 &&
              !isLoading && (
                <section className="chat-start">
                  <div className="eyebrow">
                    <span />
                    {mode === "report"
                      ? "Research & write"
                      : mode === "coding"
                        ? "Build & understand"
                        : "Think & explore"}
                  </div>
                  <h2>
                    {mode === "report"
                      ? "Tulisan yang kuat dimulai dari ide."
                      : mode === "coding"
                        ? "Mari bangun sesuatu yang bekerja."
                        : "Apa yang ingin kamu eksplorasi?"}
                  </h2>
                  <p>
                    Berikan konteks, pilih model, dan kembangkan pemikiranmu
                    bersama AET AI.
                  </p>
                  <div className="prompt-grid">
                    {suggestions[mode].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt);
                          inputRef.current?.focus();
                        }}
                      >
                        <span>{prompt}</span>
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            <div className="message-stack">
              {(() => {
                const lastUserMessageId = messages
                  .slice()
                  .reverse()
                  .find((message) => message.role === "user")?.id;
                return messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mode={mode}
                    onRetry={handleReload}
                    onEdit={handleEditStart}
                    onSave={handleEditSave}
                    onCancel={handleEditCancel}
                    isEditable={!isLoading && message.id === lastUserMessageId}
                    isEditing={message.id === editingMessageId}
                    isLast={
                      Boolean(lastUserMessageId) &&
                      index === messages.length - 1 &&
                      !isLoading
                    }
                  />
                ));
              })()}
              {isLoading && !isStreamingAssistant && <SkeletonMessage />}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="icon-button scroll-bottom"
            aria-label="Ke pesan terbaru"
          >
            <ArrowDown size={17} />
          </button>
        )}
        <div className="chat-composer-area">
          <div className="chat-composer-inner">
            {requestError && <div className="feedback error" role="alert">{requestError} <button onClick={handleReload} disabled={isLoading}>Coba ulang</button></div>}
            {contextNotice && <p className="feedback" role="status">{contextNotice}</p>}
            {!isAvailableModel(selectedModel) && <p className="feedback error" role="alert">{modelName} sudah tidak aktif. Riwayat tetap dapat dibaca. Pilih model lain untuk melanjutkan.</p>}
            {storageError && (
              <p className="feedback error" role="alert">
                {storageError}
              </p>
            )}
            {attachment && (
              <div className="attachment-preview">
                <div className="attachment-thumbnail">
                  {attachment.type === "image" ? (
                    <NextImage
                      src={attachment.content}
                      alt="Pratinjau lampiran"
                      fill
                      unoptimized
                      sizes="42px"
                      className="object-cover"
                    />
                  ) : (
                    <FileText size={19} />
                  )}
                </div>
                <div className="attachment-label">
                  <strong>{attachment.fileName}</strong>
                  <small>
                    {attachment.type === "image" ? "Gambar" : "Dokumen teks"}
                  </small>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="icon-button danger"
                  aria-label="Hapus lampiran"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              aria-label="Pilih PDF, DOCX, TXT, atau gambar"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*"
              capture="environment"
              aria-label="Ambil gambar dari kamera"
            />
            <div className="chat-composer">
              <label htmlFor="chat-input" className="sr-only">
                Pesan untuk {modeTitle}
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Kirim pesan ke ${modeTitle}...`}
                rows={1}
                disabled={isLoading}
              />
              <div className="composer-toolbar">
                <div className="composer-tools">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="icon-button"
                    aria-label="Lampirkan dokumen"
                    title="Lampirkan PDF, DOCX, TXT (maks. 5 MB). Gambar mengikuti kemampuan model."
                    disabled={isLoading || isAttachmentLoading}
                  >
                    {isAttachmentLoading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Paperclip size={17} />
                    )}
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="icon-button"
                    aria-label="Kamera"
                    title={activeModel?.supportsImageInput === true ? "Kamera" : "Analisis gambar belum terverifikasi"}
                    disabled={isLoading || isAttachmentLoading || activeModel?.supportsImageInput !== true}
                  >
                    <Camera size={17} />
                  </button>
                  <span className="composer-hint">
                    Shift + Enter untuk baris baru
                  </span>
                </div>
                <div className="composer-send">
                  <button
                    ref={modelsBtnRef}
                    onClick={openModelPicker}
                    disabled={isLoading}
                    className="model-trigger"
                    aria-haspopup="dialog"
                    aria-expanded={isModelOpen}
                    aria-controls="model-picker"
                    title="Ganti model AI"
                  >
                    <Bot size={13} />
                    <span>{modelName}</span>
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => isLoading ? requests.current.stop() : handleSend()}
                    disabled={!isLoading && !canSend}
                    className="send-button"
                    aria-label={isLoading ? "Hentikan jawaban" : "Kirim pesan"}
                  >
                    {isLoading ? (
                      <Square size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p className="composer-disclaimer">
              AI dapat melakukan kesalahan. Periksa kembali informasi penting.
            </p>
          </div>
        </div>
      </main>
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Percakapan tersimpan">
        <button className="button button-primary" onClick={createConversation} disabled={!conversationStore}>Percakapan baru</button>
        <input className="conversation-search" value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} placeholder="Cari percakapan..." aria-label="Cari percakapan tersimpan" />
        <div className="conversation-list dialog-conversations">{historyConversations.map(c => <div key={c.id} className="conversation-item">
            <button className={c.id === conversationStore?.activeId ? "active" : ""} aria-current={c.id === conversationStore?.activeId ? "true" : undefined} onClick={() => activateConversation(c)}>{c.title}</button>
            <button className="conversation-delete" aria-label={`Hapus percakapan ${c.title}`} title={`Hapus ${c.title}`} onClick={() => requestDeleteConversation(c.id)}><Trash2 size={14} /></button>
          </div>)}</div>
        <div className="dialog-actions"><button className="button button-secondary" disabled={!hasSavedActive} onClick={() => { setHistoryOpen(false); setRenameTitle(conversationStore?.conversations.find(c => c.id === conversationStore.activeId)?.title || ""); setRenameOpen(true); }}>Ganti nama</button><button className="button button-secondary" disabled={!hasSavedActive} onClick={() => conversationStore && requestDeleteConversation(conversationStore.activeId)}>Hapus percakapan ini</button></div>
      </Dialog>
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} title="Ganti nama percakapan">
        <form onSubmit={e => { e.preventDefault(); if (!storeRef.current || !renameTitle.trim()) return; persistStore({ ...storeRef.current, conversations: storeRef.current.conversations.map(c => c.id === storeRef.current!.activeId ? { ...c, title: renameTitle.trim().slice(0,100) } : c) }); setRenameOpen(false); }}>
          <input aria-label="Nama percakapan" maxLength={100} value={renameTitle} onChange={e => setRenameTitle(e.target.value)} className="conversation-search" required />
          <button className="button button-primary" type="submit">Simpan nama</button>
        </form>
      </Dialog>
      {isModelOpen && (
        <div
          ref={modelsRef}
          id="model-picker"
          className="model-popover"
          role="dialog"
          aria-label="Pilih model AI"
          style={modelPosition}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsModelOpen(false);
              modelsBtnRef.current?.focus();
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const options = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  ".model-option:not(:disabled)",
                ),
              );
              const index = options.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              options[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  options.length) %
                  options.length
              ]?.focus();
            }
          }}
        >
          <div className="model-popover-title">
            <span>Pilih model AI</span>
            <button
              onClick={() => {
                setIsModelOpen(false);
                modelsBtnRef.current?.focus();
              }}
              className="icon-button"
              aria-label="Tutup pilihan model"
            >
              <X size={16} />
            </button>
          </div>
          <input
            autoFocus
            value={modelSearch}
            onChange={(event) => setModelSearch(event.target.value)}
            className="model-search"
            placeholder="Cari model atau provider..."
            aria-label="Cari model atau provider"
          />
          <div className="model-options custom-scrollbar">
            {filteredModels.length === 0 && (
              <p className="small muted p-4">Model tidak ditemukan.</p>
            )}
            {filteredModels.map((model) => {
              const locked = model.isFrontier && !hasFrontierAccess;
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    handleModelSelect(model);
                    modelsBtnRef.current?.focus();
                  }}
                  disabled={model.availability !== "available"}
                  aria-pressed={selectedModel === model.id}
                  className="model-option"
                >
                  {locked ? <KeyRound size={16} /> : <Bot size={16} />}
                  <span className="model-option-info">
                    <strong>
                      {model.name}
                      <span className={`tier ${locked ? "locked" : ""}`}>
                        {model.availability !== "available" ? "Belum tersedia" : locked ? "Frontier · Terkunci" : model.tier}
                      </span>
                    </strong>
                    <small>
                      {model.provider} · {model.desc}
                    </small>
                  </span>
                  {selectedModel === model.id && <Check size={16} />}
                </button>
              );
            })}
          </div>
          <p className="small muted px-2 pt-3 pb-1">
            Model Frontier memerlukan verifikasi AET.
          </p>
        </div>
      )}
      <Dialog
        open={isFrontierModalOpen && Boolean(frontierTargetModel)}
        onClose={() => setIsFrontierModalOpen(false)}
        title="Akses model Frontier"
        busy={isVerifyingFrontier}
      >
        <p>
          Verifikasi pengetahuan AET untuk menggunakan{" "}
          <strong>{frontierTargetModel?.name}</strong>.
        </p>
        <form onSubmit={handleFrontierSubmit} className="frontier-form">
          {AET_FRONTIER_QUESTIONS.map((question) => (
            <label key={question.id}>
              {question.question}
              <input
                value={frontierAnswers[question.id]}
                onChange={(event) =>
                  handleFrontierAnswerChange(question.id, event.target.value)
                }
                placeholder={question.placeholder}
                disabled={isVerifyingFrontier}
                required
              />
            </label>
          ))}
          {frontierError && (
            <p role="alert" className="feedback error">
              {frontierError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              onClick={() => setIsFrontierModalOpen(false)}
              disabled={isVerifyingFrontier}
              className="button button-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canVerifyFrontier}
              className="button button-primary"
            >
              {isVerifyingFrontier && (
                <Loader2 size={15} className="animate-spin" />
              )}
              Verifikasi akses
            </button>
          </div>
        </form>
      </Dialog>
      <Dialog open={Boolean(deleteTargetId)} onClose={() => setDeleteTargetId(null)} title="Hapus percakapan ini?">
        <p>Percakapan <strong>{deleteTarget?.title}</strong> akan dihapus dari riwayat di browser ini. Percakapan lain tetap tersedia. Tindakan ini tidak dapat dibatalkan.</p>
        {storageError && <p className="feedback error" role="alert">{storageError}</p>}
        <div className="dialog-actions">
          <button onClick={() => setDeleteTargetId(null)} className="button button-secondary">Batal</button>
          <button onClick={confirmDeleteConversation} className="button button-danger"><Trash2 size={15} /> Hapus percakapan</button>
        </div>
      </Dialog>
    </div>
  );
}
