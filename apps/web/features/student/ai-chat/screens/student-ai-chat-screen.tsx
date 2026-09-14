"use client";

import {
  ArrowLeft,
  BookOpen,
  Bot,
  ChevronRight,
  ImagePlus,
  LibraryBig,
  Loader2,
  MessageCirclePlus,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { AiChatMessageBubble } from "@/features/ai-chat/components/ai-chat-message-bubble";
import { formatAiChatPreview } from "@/features/ai-chat/utils/ai-chat-preview";
import { createOptimisticAiChatTitle } from "@/features/ai-chat/utils/ai-chat-title";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  getAiChatRuntimeSettings,
  listAiChatConversations,
  listAiChatMessages,
  streamAiChatMessage,
  uploadAiChatImage,
} from "@/features/student/ai-chat/api/student-ai-chat-api";
import type {
  AiChatConversation,
  AiChatActiveActivity,
  AiChatMessage,
  AiChatRuntimeSettings,
  AiChatScopeType,
  AiChatTarget,
  PendingChatImage,
} from "@/features/student/ai-chat/types/ai-chat-types";
import { uploadChatImagesWithConcurrency } from "@/features/student/ai-chat/utils/upload-chat-images";
import {
  readAiChatActiveActivity,
  readAiChatPreferredLessonIds,
  readAiChatTarget,
  replaceAiChatActivityQuery,
} from "@/features/student/ai-chat/utils/ai-chat-link";
import type { AppThemeMode } from "@/lib/theme-store";
import { cn } from "@/lib/utils";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const fallbackChatSettings: AiChatRuntimeSettings = {
  embeddingCatalogItemId: null,
  embeddingProvider: "OPENAI",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  maxImagesPerMessage: 5,
  maxImageBytes: 10 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  studentDailyMessageLimit: 20,
  studentDailyImageLimit: 20,
  studentDailyMessageUsed: 0,
  studentDailyMessageRemaining: 20,
  studentDailyImageUsed: 0,
  studentDailyImageRemaining: 20,
  version: 0,
};

export function StudentAiChatScreen({
  initialThemeMode,
}: {
  initialThemeMode: AppThemeMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  const [conversations, setConversations] = useState<AiChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    searchParams.get("conversation"),
  );
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isNewChat, setIsNewChat] = useState(false);
  const [liveConversationTitle, setLiveConversationTitle] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]);
  const entryActivityRef = useRef<AiChatActiveActivity | undefined>(
    readAiChatActiveActivity(searchParams),
  );
  const entryTargetRef = useRef<AiChatTarget | undefined>(readAiChatTarget(searchParams));
  const [activeActivity, setActiveActivity] = useState<AiChatActiveActivity | undefined>(
    () => readAiChatActiveActivity(searchParams),
  );
  const [target, setTarget] = useState<AiChatTarget | undefined>(() =>
    readAiChatTarget(searchParams),
  );
  const [runtimeSettings, setRuntimeSettings] = useState(fallbackChatSettings);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipInitialMessageLoadRef = useRef<string | null>(null);
  const pendingImagesRef = useRef<PendingChatImage[]>([]);
  const requestedScope: AiChatScopeType =
    searchParams.get("scope") === "COURSE" ? "COURSE" : "LIBRARY";
  const requestedLearningPathId = searchParams.get("learningPathId") ?? undefined;
  const requestedSurfaceLessonId = searchParams.get("surfaceLessonId") ?? undefined;
  const requestedPreferredLessonIds = readAiChatPreferredLessonIds(searchParams);
  const requestedVideoPlaybackSeconds = readNonNegativeQueryNumber(
    searchParams.get("videoPlaybackSeconds"),
  );
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const showChat = Boolean(conversationId || isNewChat);
  const availableImagesThisTurn = Math.min(
    runtimeSettings.maxImagesPerMessage,
    runtimeSettings.studentDailyImageRemaining,
  );

  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      const result = await listAiChatConversations(token);
      setConversations(result.items);
    } catch (error) {
      toast.error("Chưa tải được lịch sử Chat AI", {
        description: getUserFacingErrorMessage(error),
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [token]);

  const refreshRuntimeSettings = useCallback(async () => {
    if (!token) return;
    try {
      setRuntimeSettings(await getAiChatRuntimeSettings(token));
    } catch {
      // Backend remains authoritative if this optional UI refresh is unavailable.
    }
  }, [token]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    void refreshRuntimeSettings();
  }, [refreshRuntimeSettings]);

  useEffect(() => {
    if (!token || !conversationId) {
      if (!conversationId) setMessages([]);
      return;
    }
    if (skipInitialMessageLoadRef.current === conversationId) {
      skipInitialMessageLoadRef.current = null;
      return;
    }
    setIsLoadingMessages(true);
    listAiChatMessages(conversationId, token)
      .then((result) => setMessages(result.items))
      .catch((error) =>
        toast.error("Chưa tải được cuộc trò chuyện", {
          description: getUserFacingErrorMessage(error),
        }),
      )
      .finally(() => setIsLoadingMessages(false));
  }, [conversationId, token]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: isSending ? "smooth" : "auto" });
    }
  }, [isSending, messages]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(
    () => () => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  function startNewChat() {
    shouldAutoScrollRef.current = true;
    setConversationId(null);
    setMessages([]);
    setIsNewChat(true);
    setLiveConversationTitle(null);
    setDraft("");
    const entryActivity = entryActivityRef.current;
    const entryTarget = entryTargetRef.current;
    setActiveActivity(entryActivity);
    setTarget(entryTarget);
    const query = new URLSearchParams(searchParams.toString());
    query.delete("conversation");
    replaceAiChatActivityQuery(query, entryActivity, entryTarget);
    router.replace(`/student/ai-chat?${query.toString()}`, { scroll: false });
  }

  function openConversation(id: string) {
    shouldAutoScrollRef.current = true;
    setConversationId(id);
    setIsNewChat(false);
    setLiveConversationTitle(null);
    const entryActivity = entryActivityRef.current;
    const entryTarget = entryTargetRef.current;
    setActiveActivity(entryActivity);
    setTarget(entryTarget);
    const query = new URLSearchParams(searchParams.toString());
    replaceAiChatActivityQuery(query, entryActivity, entryTarget);
    query.set("conversation", id);
    router.replace(`/student/ai-chat?${query.toString()}`, { scroll: false });
  }

  function closeMobileChat() {
    setConversationId(null);
    setIsNewChat(false);
    setLiveConversationTitle(null);
    setMessages([]);
    const query = new URLSearchParams(searchParams.toString());
    query.delete("conversation");
    router.replace(`/student/ai-chat?${query.toString()}`, { scroll: false });
  }

  function handleImages(files: FileList | null) {
    if (!files) return;
    const incoming = [...files];
    if (pendingImages.length + incoming.length > availableImagesThisTurn) {
      toast.error(
        `Bạn chỉ còn có thể gửi ${availableImagesThisTurn} ảnh trong lượt này.`,
      );
      return;
    }
    for (const file of incoming) {
      if (
        !runtimeSettings.allowedImageMimeTypes.some((mimeType) => mimeType === file.type)
      ) {
        toast.error(
          `${file.name}: chỉ hỗ trợ ${formatImageTypes(runtimeSettings.allowedImageMimeTypes)}.`,
        );
        return;
      }
      if (file.size > runtimeSettings.maxImageBytes) {
        toast.error(
          `${file.name}: ảnh phải nhỏ hơn hoặc bằng ${formatMegabytes(runtimeSettings.maxImageBytes)} MB.`,
        );
        return;
      }
    }
    setPendingImages((current) => [
      ...current,
      ...incoming.map((file) => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(localId: string) {
    setPendingImages((current) => {
      const removed = current.find((image) => image.localId === localId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.localId !== localId);
    });
  }

  async function sendMessage() {
    const question = draft.trim();
    if (!token || !question || isSending || isUploading) return;
    if (requestedScope === "COURSE" && !requestedLearningPathId && !conversationId) {
      toast.error("Không xác định được khóa học cho cuộc trò chuyện mới.");
      return;
    }
    const localUserId = `local-user-${Date.now()}`;
    const isFirstMessage = !conversationId;
    let didStartConversation = false;
    shouldAutoScrollRef.current = true;
    setMessages((current) => [
      ...current,
      {
        id: localUserId,
        role: "USER",
        status: "COMPLETED",
        responsePolicy: "FULL_ANSWER",
        text: question,
        errorCode: null,
        sources: [],
        attachments: pendingImages.map((image) => ({
          id: image.localId,
          name: image.file.name,
          mimeType: image.file.type,
          sizeBytes: image.file.size,
          url: image.previewUrl,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setIsSending(true);
    if (isFirstMessage) {
      setLiveConversationTitle(createOptimisticAiChatTitle(question));
    }

    try {
      setIsUploading(pendingImages.length > 0);
      const uploads = await uploadChatImagesWithConcurrency(
        pendingImages,
        async (image) => (await uploadAiChatImage(image.file, token)).id,
      );
      setIsUploading(false);
      const oldImages = pendingImages;
      setPendingImages([]);
      await streamAiChatMessage({
        token,
        conversationId: conversationId ?? undefined,
        scopeType: requestedScope,
        learningPathId: requestedLearningPathId,
        surfaceLessonId: requestedSurfaceLessonId,
        preferredLessonIds: requestedPreferredLessonIds,
        videoPlaybackSeconds: requestedVideoPlaybackSeconds,
        target,
        activeActivity,
        message: question,
        attachmentFileIds: uploads,
        onEvent: (event) => {
          if (event.type === "started") {
            didStartConversation = true;
            skipInitialMessageLoadRef.current = event.conversationId;
            setConversationId(event.conversationId);
            setIsNewChat(false);
            setLiveConversationTitle(event.title);
            void refreshConversations();
            setMessages((current) => [
              ...current.map((message) =>
                message.id === localUserId
                  ? { ...message, id: event.userMessageId, responsePolicy: event.policy }
                  : message,
              ),
              {
                id: event.assistantMessageId,
                role: "ASSISTANT",
                status: "GENERATING",
                responsePolicy: event.policy,
                text: "",
                errorCode: null,
                sources: [],
                attachments: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]);
            const query = new URLSearchParams(searchParams.toString());
            query.set("conversation", event.conversationId);
            router.replace(`/student/ai-chat?${query.toString()}`, { scroll: false });
          } else if (event.type === "delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.assistantMessageId
                  ? { ...message, text: message.text + event.delta }
                  : message,
              ),
            );
          } else if (event.type === "title_updated") {
            setLiveConversationTitle(event.title);
            setConversations((current) =>
              current.map((conversation) =>
                conversation.id === event.conversationId
                  ? { ...conversation, title: event.title }
                  : conversation,
              ),
            );
          } else if (event.type === "completed") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.message.id ? event.message : message,
              ),
            );
            void refreshRuntimeSettings();
          } else if (event.type === "failed") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.assistantMessageId
                  ? {
                      ...message,
                      text: event.message,
                      status: "FAILED",
                      errorCode: event.code,
                    }
                  : message,
              ),
            );
          }
        },
      });
      oldImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      await refreshConversations();
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== localUserId));
      if (isFirstMessage && !didStartConversation) {
        setLiveConversationTitle(null);
      }
      toast.error("Chưa gửi được câu hỏi", {
        description: getUserFacingErrorMessage(error),
      });
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  }

  return (
    <main
      className="min-h-[calc(100svh-4.5rem)] bg-[var(--student-screen-bg)] px-3 py-3 sm:px-5 lg:min-h-screen lg:px-8 lg:py-6"
      data-theme={initialThemeMode}
      data-testid="student-ai-chat-screen"
    >
      <div className="mx-auto flex h-[calc(100svh-6.5rem)] max-w-6xl overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-[0_18px_60px_rgba(14,116,180,0.12)] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] lg:h-[calc(100svh-3rem)]">
        <aside
          className={cn(
            "w-full shrink-0 border-r border-sky-100 dark:border-[var(--theme-border)] md:w-[22rem]",
            showChat && "hidden md:flex",
            !showChat && "flex",
            "flex-col",
          )}
        >
          <div className="border-b border-sky-100 p-4 dark:border-[var(--theme-border)]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Quay lại"
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <ClassHeroLogo className="h-9 max-w-36" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-slate-950 dark:text-white">
                  Chat với AI
                </h1>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Một lịch sử cho mọi phạm vi
                </p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              data-testid="new-ai-chat-button"
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 font-black text-white shadow-[0_5px_0_#174ea6] transition hover:bg-blue-700 active:translate-y-1 active:shadow-none"
            >
              <MessageCirclePlus className="h-5 w-5" />
              Tạo cuộc trò chuyện mới
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto p-3"
            data-testid="ai-chat-history-list"
          >
            {isLoadingList ? (
              <div className="grid min-h-48 place-items-center text-sm font-bold text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="mx-2 mt-6 rounded-3xl bg-sky-50 p-5 text-center dark:bg-slate-800">
                <Bot className="mx-auto h-9 w-9 text-blue-500" />
                <p className="mt-3 font-black text-slate-800 dark:text-white">
                  Chưa có cuộc trò chuyện
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tạo cuộc trò chuyện đầu tiên để hỏi về bài học của bạn.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className={cn(
                      "group w-full rounded-2xl border p-3 text-left transition",
                      conversation.id === conversationId
                        ? "border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                        : "border-transparent hover:border-sky-100 hover:bg-sky-50/70 dark:hover:border-slate-700 dark:hover:bg-slate-800",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                        {conversation.scopeType === "LIBRARY" ? (
                          <LibraryBig className="h-4 w-4" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                          {conversation.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {formatAiChatPreview(conversation.preview) ||
                            conversation.scopeLabel}
                        </span>
                        <span className="mt-2 inline-flex rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                          {conversation.scopeType === "LIBRARY"
                            ? "Thư viện"
                            : conversation.scopeLabel}
                        </span>
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-w-0 flex-1 flex-col bg-gradient-to-b from-sky-50/70 to-white dark:from-slate-950 dark:to-[var(--theme-surface)]",
            showChat ? "flex" : "hidden md:flex",
          )}
        >
          <header className="flex min-h-16 items-center gap-3 border-b border-sky-100 bg-white/90 px-3 backdrop-blur dark:border-[var(--theme-border)] dark:bg-slate-900/90 sm:px-5">
            <button
              type="button"
              onClick={closeMobileChat}
              aria-label="Về danh sách trò chuyện"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-sky-50 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-black text-slate-950 dark:text-white">
                {liveConversationTitle ??
                  selectedConversation?.title ??
                  "Cuộc trò chuyện mới"}
              </h2>
              <p className="truncate text-xs font-bold text-blue-600 dark:text-sky-300">
                {selectedConversation?.scopeLabel ??
                  (requestedScope === "LIBRARY"
                    ? "Các khóa học đã mua"
                    : "Khóa học đang học")}
              </p>
            </div>
          </header>

          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
            aria-live="polite"
            onScroll={() => {
              const container = messagesScrollRef.current;
              if (!container) return;
              shouldAutoScrollRef.current =
                container.scrollHeight - container.scrollTop - container.clientHeight <
                80;
            }}
          >
            {isLoadingMessages ? (
              <div className="grid h-full place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto grid h-full max-w-md place-content-center text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-xl shadow-blue-200/60 dark:shadow-none">
                  <Sparkles className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
                  Bạn muốn hỏi gì hôm nay?
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  AI chỉ dùng nội dung trong phạm vi bạn đã mua. Khi câu Quiz hoặc thẻ
                  Flashcard chưa mở đáp án, AI chỉ đưa gợi ý.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((message) => (
                  <AiChatMessageBubble key={message.id} message={message} />
                ))}
                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          <footer className="border-t border-sky-100 bg-white p-3 dark:border-[var(--theme-border)] dark:bg-slate-900 sm:p-4">
            <div className="mx-auto max-w-3xl">
              {pendingImages.length > 0 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {pendingImages.map((image) => (
                    <div
                      key={image.localId}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-sky-100 bg-slate-100"
                    >
                      <img
                        src={image.previewUrl}
                        alt={image.file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(image.localId)}
                        aria-label={`Bỏ ảnh ${image.file.name}`}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-950/75 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-[1.35rem] border-2 border-sky-100 bg-sky-50/60 p-2 transition focus-within:border-blue-300 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-500 dark:focus-within:bg-slate-950">
                <input
                  ref={fileInputRef}
                  type="file"
                  data-testid="ai-chat-image-input"
                  accept={runtimeSettings.allowedImageMimeTypes.join(",")}
                  multiple
                  className="hidden"
                  onChange={(event) => handleImages(event.target.files)}
                />
                {pendingImages.length < availableImagesThisTurn ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    aria-label="Đính kèm ảnh"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-white hover:text-blue-600 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-sky-300"
                  >
                    {pendingImages.length ? (
                      <ImagePlus className="h-5 w-5" />
                    ) : (
                      <Paperclip className="h-5 w-5" />
                    )}
                  </button>
                ) : null}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder="Hỏi AI về nội dung bạn đang học..."
                  aria-label="Câu hỏi cho AI"
                  data-testid="ai-chat-composer"
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || isSending || isUploading}
                  aria-label="Gửi câu hỏi"
                  data-testid="send-ai-chat-message"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                >
                  {isSending || isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
                Tối đa {runtimeSettings.maxImagesPerMessage} ảnh ·{" "}
                {formatMegabytes(runtimeSettings.maxImageBytes)} MB/ảnh · còn{" "}
                {runtimeSettings.studentDailyImageRemaining}/
                {runtimeSettings.studentDailyImageLimit} ảnh hôm nay · còn{" "}
                {runtimeSettings.studentDailyMessageRemaining}/
                {runtimeSettings.studentDailyMessageLimit} câu hỏi hôm nay · AI có thể mắc
                lỗi, hãy đối chiếu bài học.
              </p>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function formatImageTypes(mimeTypes: readonly string[]) {
  const labels: Record<string, string> = {
    "image/jpeg": "JPG/JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
  };
  return mimeTypes.map((mimeType) => labels[mimeType] ?? mimeType).join(", ");
}

function formatMegabytes(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function readNonNegativeQueryNumber(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
