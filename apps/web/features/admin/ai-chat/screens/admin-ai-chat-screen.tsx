"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TiptapTextDocument } from "@learning-path/shared";
import {
  Bot,
  BookOpenCheck,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileQuestion,
  ImagePlus,
  Layers3,
  Loader2,
  MessageCirclePlus,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { AdminCoursesSidebar } from "@/components/admin/courses/admin-courses-sidebar";
import { TiptapContentView } from "@/components/common/content/tiptap-content-view";
import { getAdminNavigationItems } from "@/components/admin/courses/admin-navigation-items";
import { SelectContent } from "@/components/common/ui/select/content";
import { SelectItem } from "@/components/common/ui/select/item";
import { Select } from "@/components/common/ui/select/root";
import { SelectTrigger } from "@/components/common/ui/select/trigger";
import { SelectValue } from "@/components/common/ui/select/value";
import { AiChatMessageBubble } from "@/features/ai-chat/components/ai-chat-message-bubble";
import type {
  AiChatMessage,
  PendingChatImage,
} from "@/features/ai-chat/types/ai-chat-types";
import { createOptimisticAiChatTitle } from "@/features/ai-chat/utils/ai-chat-title";
import { formatAiChatPreview } from "@/features/ai-chat/utils/ai-chat-preview";
import {
  getAdminAiChatLessonContextOptions,
  getAdminAiChatScopeOptions,
  getAdminAiChatSession,
  getAdminAiChatTurnTrace,
  listAdminAiChatMessages,
  listAdminAiChatSessions,
  streamAdminAiChatMessage,
  updateAdminAiChatSessionConfiguration,
  uploadAdminAiChatImage,
} from "@/features/admin/ai-chat/api/admin-ai-chat-api";
import { AdminAiChatTurnInspectorDialog } from "@/features/admin/ai-chat/components/admin-ai-chat-turn-inspector-dialog";
import type {
  AdminAiChatActivityState,
  AdminAiChatConfigurationOverride,
  AdminAiChatLessonContextItem,
  AdminAiChatLessonContextOptions,
  AdminAiChatSession,
  AdminAiChatSimulationSurface,
  AdminAiChatTargetType,
} from "@/features/admin/ai-chat/types/admin-ai-chat-types";
import {
  getAiConfigurations,
  updateAiConfigurations,
} from "@/features/admin/ai-settings/api/provider-operations-api";
import { ModelConfigurationsTab } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen/components/model-configurations-tab";
import type {
  AiChatRuntimeSettings,
  AiFeatureConfiguration,
} from "@/features/admin/ai-settings/types/provider-operations-types";
import { formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";
import { uploadChatImagesWithConcurrency } from "@/features/student/ai-chat/utils/upload-chat-images";
import {
  type AdminAiConfigurationCapability,
  supportsReasoningEffort,
  supportsTemperature,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { useThemeStore } from "@/lib/theme-store";
import { cn } from "@/lib/utils";
import { usePersistentBooleanState } from "@/lib/use-persistent-boolean-state";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

type ScreenTab = "simulation" | "defaults";
type SimulationScope = "LESSON" | "COURSE" | "COURSE_SET";

const adminNavItems = getAdminNavigationItems("ai-chat");
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
  version: 0,
};

export function AdminAiChatScreen() {
  const { isAuthorized } = useAuthGuard({ allowedRoles: ["ADMIN"] });
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const queryClient = useQueryClient();
  const isDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBooleanState(
    adminSidebarCollapsedStorageKey,
    false,
    adminSidebarCollapsedDatasetKey,
  );
  const enabled = isAuthorized && Boolean(token);
  const [tab, setTab] = useState<ScreenTab>("simulation");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [liveSessionTitle, setLiveSessionTitle] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<SimulationScope>("LESSON");
  const [selectedLearningPathIds, setSelectedLearningPathIds] = useState<string[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [simulationSurface, setSimulationSurface] =
    useState<AdminAiChatSimulationSurface | null>(null);
  const [videoPlaybackSeconds, setVideoPlaybackSeconds] = useState(0);
  const [selectedContextSetId, setSelectedContextSetId] = useState("");
  const [selectedContextItemId, setSelectedContextItemId] = useState("");
  const [activityState, setActivityState] = useState<AdminAiChatActivityState | null>(
    null,
  );
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]);
  const [configurationOverride, setConfigurationOverride] =
    useState<AdminAiChatConfigurationOverride | null>(null);
  const [selectedTraceMessageId, setSelectedTraceMessageId] = useState<string | null>(
    null,
  );
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const [isTraceDialogOpen, setIsTraceDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const pendingImagesRef = useRef<PendingChatImage[]>([]);
  const hydratedSessionIdRef = useRef<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["admin-ai-chat", "sessions"],
    queryFn: () => listAdminAiChatSessions(token),
    enabled,
  });
  const configurationQuery = useQuery({
    queryKey: ["provider-operations", "ai-configurations"],
    queryFn: () => getAiConfigurations(token),
    enabled,
  });
  const chatSettings = configurationQuery.data?.chatSettings ?? fallbackChatSettings;
  const sessionQuery = useQuery({
    queryKey: ["admin-ai-chat", "session", selectedSessionId],
    queryFn: () => getAdminAiChatSession(selectedSessionId!, token),
    enabled: enabled && Boolean(selectedSessionId) && !isCreating && !isSending,
  });
  const messagesQuery = useQuery({
    queryKey: ["admin-ai-chat", "messages", selectedSessionId],
    queryFn: () => listAdminAiChatMessages(selectedSessionId!, token),
    enabled: enabled && Boolean(selectedSessionId) && !isCreating && !isSending,
  });
  const firstSelectedCourseId = selectedLearningPathIds[0];
  const scopeOptionsQuery = useQuery({
    queryKey: ["admin-ai-chat", "scope-options", firstSelectedCourseId ?? null],
    queryFn: () => getAdminAiChatScopeOptions(token, firstSelectedCourseId),
    enabled,
  });
  const provisionalSelectedSession =
    sessionQuery.data ??
    sessionsQuery.data?.items.find((session) => session.id === selectedSessionId) ??
    null;
  const activeLessonId = isCreating
    ? selectedLessonId
    : (provisionalSelectedSession?.scopeItems[0]?.lessonId ?? selectedLessonId);
  const lessonContextQuery = useQuery({
    queryKey: ["admin-ai-chat", "lesson-context", activeLessonId],
    queryFn: () => getAdminAiChatLessonContextOptions(activeLessonId, token),
    enabled:
      enabled &&
      Boolean(activeLessonId) &&
      (isCreating
        ? scopeType === "LESSON" || scopeType === "COURSE"
        : provisionalSelectedSession?.scopeType === "LESSON" ||
          provisionalSelectedSession?.scopeType === "COURSE"),
  });
  const traceQuery = useQuery({
    queryKey: ["admin-ai-chat", "trace", selectedSessionId, selectedTraceMessageId],
    queryFn: () =>
      getAdminAiChatTurnTrace(selectedSessionId!, selectedTraceMessageId!, token),
    enabled: enabled && Boolean(selectedSessionId) && Boolean(selectedTraceMessageId),
    refetchInterval: (query) =>
      query.state.data?.generation.status === "RUNNING" ? 1_000 : false,
  });

  useEffect(() => {
    if (messagesQuery.data) setMessages(messagesQuery.data.items);
  }, [messagesQuery.data]);
  useEffect(() => {
    if (sessionQuery.data) {
      setConfigurationOverride(sessionQuery.data.configurationOverride ?? null);
      if (!isCreating && hydratedSessionIdRef.current !== sessionQuery.data.id) {
        hydratedSessionIdRef.current = sessionQuery.data.id;
        setSelectedLearningPathIds([
          ...new Set(sessionQuery.data.scopeItems.map((item) => item.learningPathId)),
        ]);
        setSelectedLessonId(resolveAdminSessionLessonId(sessionQuery.data));
        setSimulationSurface(null);
        setSelectedContextSetId("");
        setSelectedContextItemId("");
        setActivityState(null);
        setVideoPlaybackSeconds(0);
      }
    }
  }, [isCreating, sessionQuery.data]);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: isSending ? "smooth" : "auto" });
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

  const defaultConfigurationMutation = useMutation({
    mutationFn: (input: {
      configurations: AiFeatureConfiguration[];
      chatSettings?: AiChatRuntimeSettings;
    }) => updateAiConfigurations(input.configurations, token, input.chatSettings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["provider-operations", "ai-configurations"],
      });
      toast.success("Đã lưu thiết lập mặc định cho Chat AI");
    },
    onError: (error) =>
      toast.error("Chưa thể lưu thiết lập mặc định", {
        description: getUserFacingErrorMessage(error),
      }),
  });

  const sessionConfigurationMutation = useMutation({
    mutationFn: (input: {
      session: AdminAiChatSession;
      override: AdminAiChatConfigurationOverride | null;
    }) =>
      updateAdminAiChatSessionConfiguration(
        input.session.id,
        {
          configurationOverride: input.override,
          expectedVersion: input.session.configurationVersion,
        },
        token,
      ),
    onSuccess: async (updated) => {
      setConfigurationOverride(updated.configurationOverride ?? null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-ai-chat", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-ai-chat", "session", updated.id],
        }),
      ]);
      toast.success("Đã lưu cấu hình cho các lượt tiếp theo");
    },
    onError: (error) =>
      toast.error("Chưa thể lưu cấu hình phiên", {
        description: getUserFacingErrorMessage(error),
      }),
  });

  if (!isAuthorized) return null;

  const sessions = sessionsQuery.data?.items ?? [];
  const selectedSession = provisionalSelectedSession;
  const scopeOptions = scopeOptionsQuery.data;
  const models =
    configurationQuery.data?.models.filter((model) => {
      const capabilities = readCapabilities(model.capabilities);
      return capabilities.features.includes("CHAT") && model.status !== "DISABLED";
    }) ?? [];
  const defaultChatConfiguration = configurationQuery.data?.configurations.find(
    (configuration) =>
      configuration.feature === "CHAT" && configuration.purpose === "TEXT",
  );
  const contextSets = getSimulationContextSets(
    lessonContextQuery.data,
    simulationSurface,
  );
  const selectedContextSet =
    contextSets.find((set) => set.id === selectedContextSetId) ?? contextSets[0];
  const simulationTargetType = getSimulationTargetType(simulationSurface);
  const isTargetSurface = Boolean(simulationTargetType);
  const isSimulationContextReady =
    !isTargetSurface || Boolean(selectedContextItemId && activityState);
  const isTestChatBlocked =
    simulationSurface === "TEST" &&
    activityState === "IN_PROGRESS" &&
    Boolean(selectedContextItemId);

  function resetSimulationContext() {
    setSimulationSurface(null);
    setSelectedContextSetId("");
    setSelectedContextItemId("");
    setActivityState(null);
    setVideoPlaybackSeconds(0);
  }

  function selectSimulationSurface(surface: AdminAiChatSimulationSurface | null) {
    setSimulationSurface(surface);
    setSelectedContextSetId("");
    setSelectedContextItemId("");
    setVideoPlaybackSeconds(0);
    setActivityState(
      surface === "QUIZ" || surface === "FLASHCARD"
        ? "UNANSWERED"
        : surface === "TEST"
          ? "IN_PROGRESS"
          : null,
    );
  }

  function startNewSession() {
    hydratedSessionIdRef.current = null;
    setSelectedSessionId(null);
    setMessages([]);
    setIsCreating(true);
    setLiveSessionTitle(null);
    setScopeType("LESSON");
    setSelectedLearningPathIds([]);
    setSelectedLessonId("");
    resetSimulationContext();
    setConfigurationOverride(null);
    setSelectedTraceMessageId(null);
    setIsConfigurationOpen(false);
    setIsTraceDialogOpen(false);
  }

  function openSession(session: AdminAiChatSession) {
    hydratedSessionIdRef.current = session.id;
    setSelectedSessionId(session.id);
    setIsCreating(false);
    setLiveSessionTitle(null);
    setSelectedLearningPathIds([
      ...new Set(session.scopeItems.map((item) => item.learningPathId)),
    ]);
    setSelectedLessonId(resolveAdminSessionLessonId(session));
    resetSimulationContext();
    setSelectedTraceMessageId(null);
    setIsConfigurationOpen(false);
    setIsTraceDialogOpen(false);
  }

  function changeScope(nextScope: SimulationScope) {
    setScopeType(nextScope);
    setSelectedLearningPathIds([]);
    setSelectedLessonId("");
    resetSimulationContext();
  }

  function toggleLearningPath(id: string) {
    resetSimulationContext();
    if (scopeType !== "COURSE_SET") {
      setSelectedLearningPathIds([id]);
      setSelectedLessonId("");
      return;
    }
    setSelectedLearningPathIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= 20
          ? current
          : [...current, id],
    );
  }

  function handleImages(files: FileList | null) {
    if (!files) return;
    const incoming = [...files];
    if (pendingImages.length + incoming.length > chatSettings.maxImagesPerMessage) {
      toast.error(
        `Mỗi tin nhắn chỉ được đính kèm tối đa ${chatSettings.maxImagesPerMessage} ảnh.`,
      );
      return;
    }
    for (const file of incoming) {
      if (
        !chatSettings.allowedImageMimeTypes.some((mimeType) => mimeType === file.type)
      ) {
        toast.error(
          `${file.name}: chỉ hỗ trợ ${formatImageTypes(chatSettings.allowedImageMimeTypes)}.`,
        );
        return;
      }
      if (file.size > chatSettings.maxImageBytes) {
        toast.error(
          `${file.name}: ảnh phải nhỏ hơn hoặc bằng ${formatMegabytes(chatSettings.maxImageBytes)} MB.`,
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
    if (!question || isSending) return;
    if (isCreating) {
      if (selectedLearningPathIds.length === 0) {
        toast.error("Vui lòng chọn phạm vi khóa học.");
        return;
      }
      if (scopeType === "LESSON" && !selectedLessonId) {
        toast.error("Vui lòng chọn buổi học.");
        return;
      }
    }
    if (!isSimulationContextReady) {
      toast.error("Vui lòng chọn một câu hoặc thẻ để mô phỏng.");
      return;
    }
    if (isTestChatBlocked) {
      toast.error("Chat AI tạm khóa trong khi học sinh đang làm bài thi.");
      return;
    }
    const localUserId = `local-admin-user-${Date.now()}`;
    const isFirstMessage = isCreating;
    let didStartConversation = false;
    let streamedConversationId = selectedSessionId;
    const optimisticPolicy = activityState === "UNANSWERED" ? "HINT_ONLY" : "FULL_ANSWER";
    const localAttachments = pendingImages.map((image) => ({
      id: image.localId,
      name: image.file.name,
      mimeType: image.file.type,
      sizeBytes: image.file.size,
      url: image.previewUrl,
    }));
    setMessages((current) => [
      ...current,
      {
        id: localUserId,
        role: "USER",
        status: "COMPLETED",
        responsePolicy: optimisticPolicy,
        text: question,
        errorCode: null,
        sources: [],
        attachments: localAttachments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
    setIsSending(true);
    if (isFirstMessage) {
      setLiveSessionTitle(createOptimisticAiChatTitle(question));
    }
    try {
      const uploadedIds = await uploadChatImagesWithConcurrency(
        pendingImages,
        async (image) => (await uploadAdminAiChatImage(image.file, token)).id,
      );
      const uploadedImages = pendingImages;
      setPendingImages([]);
      await streamAdminAiChatMessage({
        token,
        sessionId: isCreating ? undefined : (selectedSessionId ?? undefined),
        scopeType: isCreating ? scopeType : undefined,
        learningPathIds: isCreating ? selectedLearningPathIds : undefined,
        lessonId: isCreating && scopeType === "LESSON" ? selectedLessonId : undefined,
        surfaceLessonId: activeLessonId || undefined,
        configurationOverride: isCreating ? configurationOverride : undefined,
        simulationSurface: simulationSurface ?? undefined,
        videoPlaybackSeconds:
          simulationSurface === "VIDEO_SUMMARY" ? videoPlaybackSeconds : undefined,
        activityState: activityState ?? undefined,
        targetType: simulationTargetType,
        targetId: simulationTargetType ? selectedContextItemId : undefined,
        message: question,
        attachmentFileIds: uploadedIds,
        onEvent: (event) => {
          if (event.type === "started") {
            didStartConversation = true;
            streamedConversationId = event.conversationId;
            setSelectedSessionId(event.conversationId);
            setIsCreating(false);
            setLiveSessionTitle(event.title);
            void queryClient.invalidateQueries({
              queryKey: ["admin-ai-chat", "sessions"],
            });
            setMessages((current) => [
              ...current.map((message) =>
                message.id === localUserId
                  ? {
                      ...message,
                      id: event.userMessageId,
                      responsePolicy: event.policy,
                    }
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
          } else if (event.type === "delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.assistantMessageId
                  ? { ...message, text: message.text + event.delta }
                  : message,
              ),
            );
          } else if (event.type === "title_updated") {
            setLiveSessionTitle(event.title);
            void Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["admin-ai-chat", "sessions"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["admin-ai-chat", "session", event.conversationId],
              }),
            ]);
          } else if (event.type === "completed") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.message.id ? event.message : message,
              ),
            );
            setSelectedTraceMessageId(event.message.id);
          } else {
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
            setSelectedTraceMessageId(event.assistantMessageId);
          }
        },
      });
      uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-ai-chat", "sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-ai-chat", "session", streamedConversationId],
        }),
      ]);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== localUserId));
      if (isFirstMessage && !didStartConversation) {
        setLiveSessionTitle(null);
      }
      toast.error("Chưa gửi được lượt mô phỏng", {
        description: getUserFacingErrorMessage(error),
      });
    } finally {
      setIsSending(false);
    }
  }

  function inspectMessage(assistantMessageId: string) {
    setSelectedTraceMessageId(assistantMessageId);
    setIsTraceDialogOpen(true);
  }

  return (
    <main data-admin-theme="true" className="theme-page">
      <div
        className={cn(
          "admin-course-shell-grid grid min-h-screen transition-[grid-template-columns] duration-200",
          isSidebarCollapsed
            ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[17rem_minmax(0,1fr)]",
        )}
      >
        <AdminCoursesSidebar
          subtitle="Giám sát Chat AI"
          items={adminNavItems}
          isDarkTheme={isDarkTheme}
          isCollapsed={isSidebarCollapsed}
          showAdminProfileTools
          onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
          onToggleDarkTheme={toggleTheme}
        />

        <section className="min-w-0 px-3 py-4 sm:px-5 lg:px-7">
          <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-extrabold text-[var(--theme-text-strong)] md:text-3xl">
                Chat với AI
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                void sessionsQuery.refetch();
                void configurationQuery.refetch();
              }}
              className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold"
            >
              <RefreshCw className="h-4 w-4" /> Làm mới
            </button>
          </header>

          <div className="mt-5 flex gap-2 border-b border-[var(--theme-border)]">
            <TabButton
              active={tab === "simulation"}
              icon={Sparkles}
              label="Mô phỏng & giám sát"
              onClick={() => setTab("simulation")}
            />
            <TabButton
              active={tab === "defaults"}
              icon={Settings2}
              label="Thiết lập mặc định"
              onClick={() => setTab("defaults")}
            />
          </div>

          {tab === "defaults" ? (
            <div className="py-6">
              {configurationQuery.isLoading ? (
                <LoadingPanel />
              ) : configurationQuery.isError || !configurationQuery.data ? (
                <AdminDataErrorState
                  title="Không tải được thiết lập Chat AI"
                  description="Vui lòng thử lại để chỉnh cấu hình mặc định."
                  onRetry={() => configurationQuery.refetch()}
                  isRetrying={configurationQuery.isFetching}
                  variant="section"
                />
              ) : (
                <ModelConfigurationsTab
                  data={configurationQuery.data}
                  featureFilter={["CHAT"]}
                  isSaving={defaultConfigurationMutation.isPending}
                  onSave={(configurations, runtimeSettings) =>
                    defaultConfigurationMutation.mutate({
                      configurations,
                      chatSettings: runtimeSettings,
                    })
                  }
                />
              )}
            </div>
          ) : (
            <div className="mt-5 grid min-h-[calc(100vh-13rem)] gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_20rem] 2xl:grid-cols-[15rem_minmax(0,1fr)_25rem]">
              <aside className="flex min-h-0 flex-col rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <div className="border-b border-[var(--theme-border)] p-3">
                  <button
                    type="button"
                    onClick={startNewSession}
                    className="theme-button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold"
                  >
                    <MessageCirclePlus className="h-4 w-4" /> Phiên mô phỏng mới
                  </button>
                </div>
                <div className="min-h-40 flex-1 overflow-y-auto p-2">
                  {sessionsQuery.isLoading ? (
                    <LoadingPanel compact />
                  ) : sessions.length === 0 ? (
                    <p className="p-4 text-center text-sm text-[var(--theme-text-muted)]">
                      Chưa có phiên mô phỏng.
                    </p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openSession(session)}
                        className={cn(
                          "mb-1 flex w-full items-start gap-2 rounded-lg border px-3 py-3 text-left transition",
                          selectedSessionId === session.id && !isCreating
                            ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
                            : "border-transparent hover:bg-[var(--theme-surface-soft)]",
                        )}
                      >
                        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold text-[var(--theme-text-strong)]">
                            {session.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[var(--theme-text-muted)]">
                            {formatAiChatPreview(session.preview) || session.scopeLabel}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 text-[var(--theme-text-muted)]" />
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <section
                data-admin-ai-chat-column="conversation"
                className="flex min-h-[38rem] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]"
              >
                <div className="border-b border-[var(--theme-border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-extrabold text-[var(--theme-text-strong)]">
                        {liveSessionTitle ??
                          (isCreating
                            ? "Phiên mô phỏng mới"
                            : (selectedSession?.title ?? "Chọn một phiên"))}
                      </h2>
                      <p className="truncate text-xs font-semibold text-[var(--theme-primary)]">
                        {isCreating ? "" : selectedSession?.scopeLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isCreating ? (
                        <div
                          aria-label="Tổng chi phí phiên"
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                        >
                          <CircleDollarSign className="h-4 w-4 shrink-0" />
                          <span className="hidden font-semibold sm:inline">
                            Tổng chi phí phiên
                          </span>
                          <strong className="whitespace-nowrap font-extrabold">
                            {sessionQuery.data
                              ? formatVnd(sessionQuery.data.totalCostVnd)
                              : "—"}
                          </strong>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIsConfigurationOpen((value) => !value)}
                        className="theme-button-neutral inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold xl:hidden"
                      >
                        <SlidersHorizontal className="h-4 w-4" /> Cấu hình
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--theme-surface-soft)] px-3 py-4 sm:px-5">
                  {isCreating ? (
                    <div className="space-y-4">
                      <NewSessionScopePanel
                        scopeType={scopeType}
                        onScopeChange={changeScope}
                        learningPaths={scopeOptions?.learningPaths ?? []}
                        lessons={scopeOptions?.lessons ?? []}
                        selectedLearningPathIds={selectedLearningPathIds}
                        selectedLessonId={selectedLessonId}
                        onToggleLearningPath={toggleLearningPath}
                        onLessonChange={(lessonId) => {
                          setSelectedLessonId(lessonId);
                          resetSimulationContext();
                        }}
                        isLoading={scopeOptionsQuery.isLoading}
                      />
                      {activeLessonId ? (
                        <SimulationContextPanel
                          scopeType={scopeType}
                          options={lessonContextQuery.data}
                          isLoading={lessonContextQuery.isLoading}
                          isError={lessonContextQuery.isError}
                          surface={simulationSurface}
                          onSurfaceChange={selectSimulationSurface}
                          sets={contextSets}
                          selectedSet={selectedContextSet}
                          selectedItemId={selectedContextItemId}
                          activityState={activityState}
                          videoPlaybackSeconds={videoPlaybackSeconds}
                          onSetChange={(setId) => {
                            setSelectedContextSetId(setId);
                            setSelectedContextItemId("");
                          }}
                          onItemChange={setSelectedContextItemId}
                          onActivityStateChange={setActivityState}
                          onVideoPlaybackSecondsChange={setVideoPlaybackSeconds}
                          onRetry={() => lessonContextQuery.refetch()}
                          showStepNumber
                        />
                      ) : null}
                    </div>
                  ) : messagesQuery.isLoading ? (
                    <LoadingPanel />
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-5">
                      {selectedSession?.scopeType === "COURSE" ? (
                        <CourseSurfaceLessonPanel
                          lessons={scopeOptions?.lessons ?? []}
                          selectedLessonId={selectedLessonId}
                          onLessonChange={(lessonId) => {
                            setSelectedLessonId(lessonId);
                            resetSimulationContext();
                          }}
                          isLoading={scopeOptionsQuery.isLoading}
                        />
                      ) : null}
                      {activeLessonId ? (
                        <SimulationContextPanel
                          scopeType={selectedSession?.scopeType ?? "LESSON"}
                          options={lessonContextQuery.data}
                          isLoading={lessonContextQuery.isLoading}
                          isError={lessonContextQuery.isError}
                          surface={simulationSurface}
                          onSurfaceChange={selectSimulationSurface}
                          sets={contextSets}
                          selectedSet={selectedContextSet}
                          selectedItemId={selectedContextItemId}
                          activityState={activityState}
                          videoPlaybackSeconds={videoPlaybackSeconds}
                          onSetChange={(setId) => {
                            setSelectedContextSetId(setId);
                            setSelectedContextItemId("");
                          }}
                          onItemChange={setSelectedContextItemId}
                          onActivityStateChange={setActivityState}
                          onVideoPlaybackSecondsChange={setVideoPlaybackSeconds}
                          onRetry={() => lessonContextQuery.refetch()}
                          compact
                          showStepNumber={false}
                        />
                      ) : null}
                      {messages.length === 0 ? (
                        <EmptyChat />
                      ) : (
                        messages.map((message) => (
                          <AiChatMessageBubble
                            key={message.id}
                            message={message}
                            onInspect={inspectMessage}
                            showAllPolicyLabels
                          />
                        ))
                      )}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--theme-border)] p-3">
                  {isTestChatBlocked ? (
                    <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      Chat AI tạm khóa trong khi học sinh đang làm bài thi. Chọn
                      “FULL_ANSWER · TOÀN PHẠM VI” để mô phỏng.
                    </div>
                  ) : null}
                  {pendingImages.length > 0 ? (
                    <div className="mb-2 flex gap-2 overflow-x-auto">
                      {pendingImages.map((image) => (
                        <div
                          key={image.localId}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--theme-border)]"
                        >
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            aria-label={`Bỏ ảnh ${image.file.name}`}
                            onClick={() => removeImage(image.localId)}
                            className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-950/75 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2 focus-within:border-[var(--theme-primary-border)]">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={chatSettings.allowedImageMimeTypes.join(",")}
                      multiple
                      className="hidden"
                      onChange={(event) => handleImages(event.target.files)}
                    />
                    <button
                      type="button"
                      aria-label="Đính kèm ảnh"
                      disabled={
                        isSending ||
                        isTestChatBlocked ||
                        pendingImages.length >= chatSettings.maxImagesPerMessage
                      }
                      onClick={() => fileInputRef.current?.click()}
                      className="grid h-10 w-10 place-items-center rounded-lg text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)] disabled:opacity-40"
                    >
                      {pendingImages.length ? (
                        <ImagePlus className="h-5 w-5" />
                      ) : (
                        <Paperclip className="h-5 w-5" />
                      )}
                    </button>
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
                      disabled={isTestChatBlocked}
                      placeholder={
                        isTestChatBlocked
                          ? "Chat bị khóa trong khi đang làm bài thi"
                          : "Nhập câu hỏi như một học sinh..."
                      }
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[var(--theme-text-strong)] outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Gửi lượt mô phỏng"
                      onClick={() => void sendMessage()}
                      disabled={
                        !draft.trim() ||
                        isSending ||
                        isTestChatBlocked ||
                        !isSimulationContextReady
                      }
                      className="theme-button-primary grid h-11 w-11 shrink-0 place-items-center rounded-lg disabled:opacity-50"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </section>

              <aside
                data-admin-ai-chat-column="configuration"
                className={cn(
                  "min-h-0 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]",
                  isConfigurationOpen ? "block" : "hidden xl:block",
                )}
              >
                <div className="border-b border-[var(--theme-border)] p-4">
                  <h2 className="flex items-center gap-2 font-extrabold text-[var(--theme-text-strong)]">
                    <SlidersHorizontal className="h-4 w-4 text-[var(--theme-primary)]" />{" "}
                    Cấu hình phiên
                  </h2>
                </div>
                <SessionConfigurationEditor
                  models={models}
                  defaultConfiguration={defaultChatConfiguration}
                  value={configurationOverride}
                  onChange={setConfigurationOverride}
                  disabled={isSending || sessionConfigurationMutation.isPending}
                  onSave={
                    !isCreating && selectedSession
                      ? () =>
                          sessionConfigurationMutation.mutate({
                            session: selectedSession,
                            override: configurationOverride,
                          })
                      : undefined
                  }
                />
              </aside>
            </div>
          )}
        </section>
      </div>
      <AdminAiChatTurnInspectorDialog
        trace={traceQuery.data}
        isOpen={isTraceDialogOpen}
        isLoading={traceQuery.isLoading || traceQuery.isFetching}
        isError={traceQuery.isError}
        onClose={() => setIsTraceDialogOpen(false)}
        onRetry={() => traceQuery.refetch()}
      />
    </main>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-extrabold",
        active
          ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
          : "border-transparent text-[var(--theme-text-muted)]",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function NewSessionScopePanel({
  scopeType,
  onScopeChange,
  learningPaths,
  lessons,
  selectedLearningPathIds,
  selectedLessonId,
  onToggleLearningPath,
  onLessonChange,
  isLoading,
}: {
  scopeType: SimulationScope;
  onScopeChange: (scope: SimulationScope) => void;
  learningPaths: Array<{
    id: string;
    title: string;
    domain: { name: string };
    _count: { lessons: number };
  }>;
  lessons: Array<{ id: string; title: string; chapter: { title: string } | null }>;
  selectedLearningPathIds: string[];
  selectedLessonId: string;
  onToggleLearningPath: (id: string) => void;
  onLessonChange: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
      <h3 className="font-extrabold text-[var(--theme-text-strong)]">
        1. Chọn phạm vi mô phỏng
      </h3>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["LESSON", "Một buổi học"],
            ["COURSE", "Một khóa học"],
            ["COURSE_SET", "Nhiều khóa học"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onScopeChange(value)}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-sm font-bold",
              scopeType === value
                ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                : "border-[var(--theme-border)] text-[var(--theme-text-muted)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
          Khóa học
        </p>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--theme-primary)]" />
        ) : (
          <div
            className={cn(
              "grid max-h-56 gap-2 overflow-y-auto",
              scopeType === "COURSE_SET" && "sm:grid-cols-2",
            )}
          >
            {learningPaths.map((path) => {
              const selected = selectedLearningPathIds.includes(path.id);
              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => onToggleLearningPath(path.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left",
                    selected
                      ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
                      : "border-[var(--theme-border)] hover:bg-[var(--theme-surface-soft)]",
                  )}
                >
                  <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                    {path.title}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--theme-text-muted)]">
                    {path.domain.name} · {path._count.lessons} buổi
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {scopeType !== "COURSE_SET" && selectedLearningPathIds.length === 1 ? (
        <CustomSelectField
          id="admin-ai-chat-lesson"
          label={
            scopeType === "COURSE" ? "Buổi học hiện tại (không bắt buộc)" : "Buổi học"
          }
          value={selectedLessonId || "__placeholder__"}
          placeholder="Chọn buổi học"
          options={[
            ...(scopeType === "COURSE"
              ? [{ value: "__none__", label: "Không chọn buổi hiện tại" }]
              : []),
            ...lessons.map((lesson) => ({
              value: lesson.id,
              label: `${lesson.chapter?.title ? `${lesson.chapter.title} · ` : ""}${lesson.title}`,
            })),
          ]}
          onValueChange={(value) => {
            if (value === "__none__") {
              onLessonChange("");
            } else if (value !== "__placeholder__") {
              onLessonChange(value);
            }
          }}
          wrapperClassName="mt-5"
        />
      ) : null}
      <div className="mt-5 rounded-lg bg-[var(--theme-primary-soft)] p-3 text-xs leading-5 text-[var(--theme-primary)]">
        Sau khi chọn phạm vi, nhập câu hỏi ở ô bên dưới. Phiên chỉ được tạo khi gửi lượt
        đầu tiên.
      </div>
    </div>
  );
}

function CourseSurfaceLessonPanel({
  lessons,
  selectedLessonId,
  onLessonChange,
  isLoading,
}: {
  lessons: Array<{ id: string; title: string; chapter: { title: string } | null }>;
  selectedLessonId: string;
  onLessonChange: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <section
      data-testid="admin-ai-chat-course-turn-context"
      className="mx-auto w-full max-w-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5"
    >
      <h3 className="font-extrabold text-[var(--theme-text-strong)]">
        Ngữ cảnh buổi học cho lượt tiếp theo
      </h3>
      <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
        Để trống khi mô phỏng từ trang chi tiết khóa học. Chọn một buổi để mô phỏng học
        sinh mở Chat từ buổi đó; phạm vi vẫn là toàn khóa.
      </p>
      {isLoading ? (
        <div className="mt-4 flex min-h-10 items-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : (
        <CustomSelectField
          id="admin-ai-chat-existing-surface-lesson"
          label="Buổi học hiện tại (không bắt buộc)"
          value={selectedLessonId || "__none__"}
          placeholder="Không chọn buổi hiện tại"
          options={[
            { value: "__none__", label: "Không chọn buổi hiện tại" },
            ...lessons.map((lesson) => ({
              value: lesson.id,
              label: `${lesson.chapter?.title ? `${lesson.chapter.title} · ` : ""}${lesson.title}`,
            })),
          ]}
          onValueChange={(value) => onLessonChange(value === "__none__" ? "" : value)}
          wrapperClassName="mt-4"
        />
      )}
    </section>
  );
}

function SimulationContextPanel({
  scopeType,
  options,
  isLoading,
  isError,
  surface,
  onSurfaceChange,
  sets,
  selectedSet,
  selectedItemId,
  activityState,
  videoPlaybackSeconds,
  onSetChange,
  onItemChange,
  onActivityStateChange,
  onVideoPlaybackSecondsChange,
  onRetry,
  compact = false,
  showStepNumber,
}: {
  scopeType: SimulationScope;
  options?: AdminAiChatLessonContextOptions;
  isLoading: boolean;
  isError: boolean;
  surface: AdminAiChatSimulationSurface | null;
  onSurfaceChange: (surface: AdminAiChatSimulationSurface | null) => void;
  sets: AdminAiChatLessonContextOptions["quizSets"];
  selectedSet?: AdminAiChatLessonContextOptions["quizSets"][number];
  selectedItemId: string;
  activityState: AdminAiChatActivityState | null;
  videoPlaybackSeconds: number;
  onSetChange: (setId: string) => void;
  onItemChange: (itemId: string) => void;
  onActivityStateChange: (state: AdminAiChatActivityState) => void;
  onVideoPlaybackSecondsChange: (seconds: number) => void;
  onRetry: () => unknown;
  compact?: boolean;
  showStepNumber: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "mx-auto grid min-h-28 max-w-2xl place-items-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]",
          compact && "max-w-none",
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }
  if (isError || !options) {
    return (
      <div
        className={cn(
          "mx-auto max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 text-sm",
          compact && "max-w-none",
        )}
      >
        <p className="text-[var(--theme-text-muted)]">
          Chưa tải được ngữ cảnh mô phỏng của buổi học.
        </p>
        <button
          type="button"
          onClick={() => void onRetry()}
          className="theme-button-neutral mt-3 min-h-9 rounded-lg px-3 text-xs font-bold"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const surfaceOptions: Array<{
    value: AdminAiChatSimulationSurface;
    label: string;
    icon: typeof Video;
    available: boolean;
  }> = [
    {
      value: "VIDEO_SUMMARY",
      label: "Tóm tắt video",
      icon: Video,
      available: options.surfaces.videoSummary.available,
    },
    {
      value: "KNOWLEDGE",
      label: "Sinh kiến thức",
      icon: BookOpenCheck,
      available: options.surfaces.knowledge.available,
    },
    {
      value: "QUIZ",
      label: "Quiz",
      icon: FileQuestion,
      available: options.quizSets.some((set) => (set.questions?.length ?? 0) > 0),
    },
    {
      value: "FLASHCARD",
      label: "Flashcard",
      icon: Layers3,
      available: options.flashcardSets.some((set) => (set.flashcards?.length ?? 0) > 0),
    },
    {
      value: "TEST",
      label: "Test",
      icon: ClipboardCheck,
      available: options.testSets.some((set) => (set.questions?.length ?? 0) > 0),
    },
  ];
  const items = getSimulationContextItems(selectedSet, surface);
  const itemLabel = surface === "FLASHCARD" ? "thẻ" : "câu";
  const isCourseScope = scopeType === "COURSE";
  const policyOptions =
    surface === "TEST"
      ? ([
          {
            state: "IN_PROGRESS",
            label: "BLOCKED",
            description:
              "AI không nhận câu hỏi và không trả lời khi học sinh đang làm bài thi.",
          },
          {
            state: "SUBMITTED",
            label: "FULL_ANSWER · TOÀN PHẠM VI",
            description: "AI được nêu đáp án và giải thích mọi câu trong bài thi đã nộp.",
          },
        ] as const)
      : ([
          {
            state: "UNANSWERED",
            label: "HINT_ONLY",
            description: `AI chỉ đưa gợi ý cho ${itemLabel} đang chọn, không nêu hoặc xác nhận đáp án.`,
          },
          {
            state: "ANSWER_REVEALED",
            label: "FULL_ANSWER · MỤC HIỆN TẠI",
            description: `AI được nêu đáp án và giải thích ${itemLabel} đang chọn; ${itemLabel} khác vẫn chỉ được gợi ý.`,
          },
          {
            state: "SUBMITTED",
            label: "FULL_ANSWER · TOÀN PHẠM VI",
            description: `AI được nêu đáp án và giải thích mọi ${itemLabel} trong bộ đã hoàn thành.`,
          },
        ] as const);

  return (
    <section
      data-testid="admin-ai-chat-simulation-context"
      className={cn(
        "mx-auto w-full max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5",
        compact && "max-w-none",
      )}
      aria-labelledby="admin-ai-chat-simulation-context-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id="admin-ai-chat-simulation-context-title"
            className="font-extrabold text-[var(--theme-text-strong)]"
          >
            {showStepNumber
              ? "2. Ngữ cảnh màn học sinh"
              : "Ngữ cảnh màn học sinh cho lượt tiếp theo"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
            {isCourseScope
              ? "Không bắt buộc. Dù chọn hay không chọn tab, phạm vi chat vẫn là toàn khóa; buổi học hiện tại chỉ được ưu tiên."
              : "Không bắt buộc. Không chọn tab để chat bình thường trong buổi học đã chọn."}
          </p>
        </div>
        {surface ? (
          <button
            type="button"
            onClick={() => onSurfaceChange(null)}
            className="theme-button-neutral min-h-9 rounded-lg px-3 text-xs font-bold"
          >
            Bỏ ngữ cảnh
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {surfaceOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!option.available}
              title={
                option.available ? option.label : `${option.label}: chưa có nội dung`
              }
              onClick={() => onSurfaceChange(option.value)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition",
                surface === option.value
                  ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                  : "border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]",
                !option.available && "cursor-not-allowed opacity-45",
              )}
            >
              <Icon className="h-4 w-4" /> {option.label}
            </button>
          );
        })}
      </div>

      {surface === "VIDEO_SUMMARY" || surface === "KNOWLEDGE" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-[var(--theme-primary-soft)] p-3 text-xs leading-5 text-[var(--theme-primary)]">
            Mô phỏng học sinh đang mở tab{" "}
            {surface === "VIDEO_SUMMARY" ? "Video" : "Lý thuyết"}. Chat dùng `FULL_ANSWER`{" "}
            {isCourseScope
              ? "trong toàn khóa học; buổi hiện tại chỉ được ưu tiên."
              : "trong buổi học đã chọn."}
          </div>
          {surface === "VIDEO_SUMMARY" ? (
            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                Mốc phát hiện tại (giây)
              </span>
              <input
                type="number"
                min={0}
                max={604800}
                step={1}
                value={videoPlaybackSeconds}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onVideoPlaybackSecondsChange(
                    Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                  );
                }}
                data-testid="admin-ai-chat-video-playback-seconds"
                className="mt-2 min-h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm font-semibold text-[var(--theme-text-strong)] outline-none focus:border-[var(--theme-primary-border)] focus:ring-2 focus:ring-[var(--theme-primary-soft)]"
              />
              <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                Khối kiến thức hoặc ví dụ trong bản tóm tắt bao phủ mốc này được ưu tiên;
                câu hỏi vẫn tìm trên toàn bộ bản tóm tắt video.
              </span>
            </label>
          ) : null}
        </div>
      ) : surface ? (
        <div className="mt-4 space-y-4">
          {sets.length > 0 ? (
            <CustomSelectField
              id={`admin-ai-chat-${surface.toLowerCase()}-set`}
              label={surface === "FLASHCARD" ? "Bộ flashcard" : "Bộ câu hỏi"}
              value={selectedSet?.id ?? "__placeholder__"}
              placeholder="Chọn bộ"
              options={sets.map((set) => ({ value: set.id, label: set.title }))}
              onValueChange={(value) => {
                if (value !== "__placeholder__") onSetChange(value);
              }}
              compact
            />
          ) : null}

          {items.length > 0 ? (
            <fieldset>
              <legend className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                {surface === "FLASHCARD" ? "Chọn thẻ" : "Chọn câu hỏi"}
              </legend>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {items.map((item, index) => {
                  const itemKind = surface === "FLASHCARD" ? "Thẻ" : "Câu";
                  const itemNumberLabel = `${itemKind} ${index + 1}`;
                  const previewContent = readSimulationItemContent(item);

                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                        selectedItemId === item.id
                          ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
                          : "border-[var(--theme-border)] hover:bg-[var(--theme-surface-soft)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="admin-ai-chat-context-item"
                        value={item.id}
                        checked={selectedItemId === item.id}
                        onChange={() => onItemChange(item.id)}
                        className="mt-1 h-4 w-4 accent-sky-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold text-[var(--theme-primary)]">
                          {itemNumberLabel}
                        </span>
                        {previewContent ? (
                          <TiptapContentView
                            ariaLabel={`Nội dung ${itemNumberLabel}`}
                            className="mt-1 text-sm leading-5 text-[var(--theme-text-strong)]"
                            content={previewContent}
                            contentAlignment="left"
                            contentMode="text-preview"
                          />
                        ) : (
                          <span
                            aria-label={`Nội dung ${itemNumberLabel}`}
                            className="mt-1 block text-sm leading-5 text-[var(--theme-text-strong)]"
                          >
                            {readSimulationItemPreview(item)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--theme-border)] p-4 text-sm text-[var(--theme-text-muted)]">
              Bộ này chưa có item mà học sinh được phép xem.
            </p>
          )}

          {selectedItemId ? (
            <fieldset>
              <legend className="text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                Chính sách và phạm vi trả lời
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {policyOptions.map((option) => (
                  <label
                    key={option.state}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                      activityState === option.state
                        ? "border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)]"
                        : "border-[var(--theme-border)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="admin-ai-chat-activity-state"
                      checked={activityState === option.state}
                      onChange={() => onActivityStateChange(option.state)}
                      className="mt-1 h-4 w-4 accent-sky-500"
                    />
                    <span>
                      <strong className="block text-xs text-[var(--theme-text-strong)]">
                        {option.label}
                      </strong>
                      <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getSimulationContextSets(
  options: AdminAiChatLessonContextOptions | undefined,
  surface: AdminAiChatSimulationSurface | null,
) {
  if (!options) return [];
  if (surface === "QUIZ") return options.quizSets;
  if (surface === "FLASHCARD") return options.flashcardSets;
  if (surface === "TEST") return options.testSets;
  return [];
}

function resolveAdminSessionLessonId(session: AdminAiChatSession) {
  if (session.scopeType === "LESSON") {
    return session.scopeItems[0]?.lessonId ?? "";
  }
  if (session.scopeType === "COURSE") {
    return session.lastSurfaceLessonId ?? "";
  }
  return "";
}

function getSimulationContextItems(
  set: AdminAiChatLessonContextOptions["quizSets"][number] | undefined,
  surface: AdminAiChatSimulationSurface | null,
) {
  if (!set) return [];
  return surface === "FLASHCARD" ? (set.flashcards ?? []) : (set.questions ?? []);
}

function getSimulationTargetType(
  surface: AdminAiChatSimulationSurface | null,
): AdminAiChatTargetType | undefined {
  if (surface === "QUIZ") return "QUIZ_QUESTION";
  if (surface === "FLASHCARD") return "FLASHCARD";
  if (surface === "TEST") return "TEST_QUESTION";
  return undefined;
}

function readSimulationItemPreview(item: AdminAiChatLessonContextItem) {
  const parts: string[] = [];
  collectRichText(item.questionJson ?? item.frontJson, parts);
  const text = parts.join(" ").replace(/\s+/gu, " ").trim();
  return text || "Nội dung chưa có mô tả văn bản";
}

function readSimulationItemContent(
  item: AdminAiChatLessonContextItem,
): TiptapTextDocument | null {
  const value = item.questionJson ?? item.frontJson;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "doc") return null;
  if (record.content !== undefined && !Array.isArray(record.content)) return null;
  return value as TiptapTextDocument;
}

function collectRichText(value: unknown, output: string[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRichText(item, output));
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") output.push(record.text);
  if (record.content) collectRichText(record.content, output);
}

function SessionConfigurationEditor({
  models,
  defaultConfiguration,
  value,
  onChange,
  disabled,
  onSave,
}: {
  models: Array<{
    id: string;
    displayName: string;
    externalKey: string;
    capabilities: unknown;
    credentialConfigured: boolean;
  }>;
  defaultConfiguration?: AiFeatureConfiguration;
  value: AdminAiChatConfigurationOverride | null;
  onChange: (value: AdminAiChatConfigurationOverride | null) => void;
  disabled: boolean;
  onSave?: () => void;
}) {
  const draft = value ?? {};
  const effectivePrimaryId =
    draft.primaryCatalogItemId ?? defaultConfiguration?.primaryCatalogItemId;
  const effectiveFallbackId = Object.prototype.hasOwnProperty.call(
    draft,
    "fallbackCatalogItemId",
  )
    ? draft.fallbackCatalogItemId
    : defaultConfiguration?.fallbackCatalogItemId;
  const primaryUsesConfiguredDefault =
    effectivePrimaryId === defaultConfiguration?.primaryCatalogItemId;
  const fallbackUsesConfiguredDefault =
    effectiveFallbackId === defaultConfiguration?.fallbackCatalogItemId;
  const primaryModel = models.find((model) => model.id === effectivePrimaryId);
  const fallbackModel = models.find((model) => model.id === effectiveFallbackId);
  const primaryCapabilities = readCapabilities(primaryModel?.capabilities);
  const fallbackCapabilities = readCapabilities(fallbackModel?.capabilities);
  const effectiveTemperature =
    draft.temperature === undefined && primaryUsesConfiguredDefault
      ? defaultConfiguration?.temperature
      : draft.temperature;
  const effectiveReasoningEffort =
    draft.reasoningEffort === undefined && primaryUsesConfiguredDefault
      ? defaultConfiguration?.reasoningEffort
      : draft.reasoningEffort;
  const effectiveMaxInputTokens =
    draft.maxInputTokens ?? defaultConfiguration?.maxInputTokens;
  const effectiveMaxOutputTokens =
    draft.maxOutputTokens ?? defaultConfiguration?.maxOutputTokens;
  const effectiveFallbackTemperature =
    draft.fallbackTemperature === undefined && fallbackUsesConfiguredDefault
      ? defaultConfiguration?.fallbackTemperature
      : draft.fallbackTemperature;
  const effectiveFallbackReasoningEffort =
    draft.fallbackReasoningEffort === undefined && fallbackUsesConfiguredDefault
      ? defaultConfiguration?.fallbackReasoningEffort
      : draft.fallbackReasoningEffort;
  const effectiveFallbackMaxOutputTokens =
    draft.fallbackMaxOutputTokens === undefined && fallbackUsesConfiguredDefault
      ? defaultConfiguration?.fallbackMaxOutputTokens
      : draft.fallbackMaxOutputTokens;
  const update = (patch: Partial<AdminAiChatConfigurationOverride>) =>
    onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4 p-4">
      <section className="space-y-3 rounded-xl border border-[var(--theme-border)] p-3">
        <CustomSelectField
          id="admin-ai-chat-primary-model"
          label="Model chính"
          value={effectivePrimaryId ?? "__unconfigured__"}
          placeholder="Chưa thiết lập model chính"
          options={models.map((model) => ({
            value: model.id,
            label: `${model.displayName} (${model.externalKey})`,
            disabled: !model.credentialConfigured,
          }))}
          disabled={disabled}
          compact
          onValueChange={(value) => {
            if (value === "__unconfigured__") return;
            const primaryCatalogItemId = value;
            update({
              primaryCatalogItemId,
              temperature: primaryCatalogItemId ? null : undefined,
              reasoningEffort: primaryCatalogItemId ? null : undefined,
              ...(primaryCatalogItemId === effectiveFallbackId
                ? {
                    fallbackCatalogItemId: null,
                    fallbackTemperature: undefined,
                    fallbackReasoningEffort: undefined,
                    fallbackMaxOutputTokens: undefined,
                  }
                : {}),
            });
          }}
        />
        {primaryModel &&
        supportsReasoningEffort(
          primaryModel.externalKey,
          primaryCapabilities.aiConfiguration,
        ) ? (
          <ReasoningOverride
            label="Reasoning Effort model chính"
            value={effectiveReasoningEffort}
            levels={primaryCapabilities.reasoningEffortLevels}
            disabled={disabled}
            onChange={(reasoningEffort) => update({ reasoningEffort, temperature: null })}
          />
        ) : primaryModel &&
          supportsTemperature(
            primaryModel.externalKey,
            primaryCapabilities.aiConfiguration,
          ) ? (
          <NumericOverride
            label="Temperature model chính"
            value={effectiveTemperature}
            min={0}
            max={2}
            step="0.1"
            disabled={disabled}
            onChange={(temperature) => update({ temperature, reasoningEffort: null })}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <NumericOverride
            label="Max input model chính"
            value={effectiveMaxInputTokens}
            min={128}
            max={2000000}
            disabled={disabled}
            onChange={(maxInputTokens) =>
              update({ maxInputTokens: maxInputTokens ?? undefined })
            }
          />
          <NumericOverride
            label="Max output model chính"
            value={effectiveMaxOutputTokens}
            min={128}
            max={100000}
            disabled={disabled}
            onChange={(maxOutputTokens) =>
              update({ maxOutputTokens: maxOutputTokens ?? undefined })
            }
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--theme-border)] p-3">
        <CustomSelectField
          id="admin-ai-chat-fallback-model"
          label="Model dự phòng"
          value={effectiveFallbackId ?? "__none__"}
          options={[
            { value: "__none__", label: "Không dùng dự phòng" },
            ...models
              .filter((model) => model.id !== effectivePrimaryId)
              .map((model) => ({
                value: model.id,
                label: `${model.displayName} (${model.externalKey})`,
                disabled: !model.credentialConfigured,
              })),
          ]}
          disabled={disabled}
          compact
          onValueChange={(nextValue) => {
            const fallbackCatalogItemId = nextValue === "__none__" ? null : nextValue;
            update({
              fallbackCatalogItemId,
              fallbackTemperature: fallbackCatalogItemId ? null : undefined,
              fallbackReasoningEffort: fallbackCatalogItemId ? null : undefined,
              fallbackMaxOutputTokens: fallbackCatalogItemId ? null : undefined,
            });
          }}
        />
        {fallbackModel ? (
          <>
            {supportsReasoningEffort(
              fallbackModel.externalKey,
              fallbackCapabilities.aiConfiguration,
            ) ? (
              <ReasoningOverride
                label="Reasoning Effort model dự phòng"
                value={effectiveFallbackReasoningEffort}
                levels={fallbackCapabilities.reasoningEffortLevels}
                disabled={disabled}
                onChange={(fallbackReasoningEffort) =>
                  update({ fallbackReasoningEffort, fallbackTemperature: null })
                }
              />
            ) : supportsTemperature(
                fallbackModel.externalKey,
                fallbackCapabilities.aiConfiguration,
              ) ? (
              <NumericOverride
                label="Temperature model dự phòng"
                value={effectiveFallbackTemperature}
                min={0}
                max={2}
                step="0.1"
                disabled={disabled}
                onChange={(fallbackTemperature) =>
                  update({ fallbackTemperature, fallbackReasoningEffort: null })
                }
              />
            ) : null}
            <NumericOverride
              label="Max output model dự phòng"
              value={effectiveFallbackMaxOutputTokens}
              min={128}
              max={100000}
              disabled={disabled}
              onChange={(fallbackMaxOutputTokens) => update({ fallbackMaxOutputTokens })}
            />
          </>
        ) : (
          <p className="text-xs leading-5 text-[var(--theme-text-muted)]">
            Không có model dự phòng đang hiệu lực.
          </p>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="theme-button-neutral min-h-10 rounded-lg px-3 text-xs font-bold"
        >
          Khôi phục thiết lập mặc định
        </button>
        {onSave ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSave}
            className="theme-button-primary inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" /> Lưu cho lượt sau
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReasoningOverride({
  label,
  value,
  levels,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  levels: string[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <CustomSelectField
      id={`admin-ai-chat-${label.toLowerCase().replaceAll(" ", "-")}`}
      label={label}
      value={value ?? "__default__"}
      options={[
        { value: "__default__", label: "Mặc định của model" },
        ...levels.map((level) => ({ value: level, label: level })),
      ]}
      disabled={disabled}
      compact
      onValueChange={(nextValue) =>
        onChange(nextValue === "__default__" ? null : nextValue)
      }
    />
  );
}

function CustomSelectField({
  id,
  label,
  value,
  placeholder,
  options,
  disabled = false,
  compact = false,
  wrapperClassName,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
  compact?: boolean;
  wrapperClassName?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={id}
        className={cn(
          "block font-extrabold text-[var(--theme-text-strong)]",
          compact
            ? "text-xs uppercase tracking-wide text-[var(--theme-text-muted)]"
            : "text-sm",
        )}
      >
        {label}
      </label>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-label={label}
          className={cn("mt-2", compact && "min-h-11 rounded-lg px-3 text-sm")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {value === "__placeholder__" || value === "__unconfigured__" ? (
            <SelectItem value={value} disabled>
              {placeholder ?? "Chọn"}
            </SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumericOverride({
  label,
  value,
  min,
  max,
  step = "1",
  disabled,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  min: number;
  max: number;
  step?: string;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
      {label}
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder="Mặc định"
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="mt-2 min-h-11 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm font-semibold normal-case tracking-normal text-[var(--theme-text-strong)]"
      />
    </label>
  );
}

function EmptyChat() {
  return (
    <div className="grid h-full place-content-center text-center">
      <Bot className="mx-auto h-10 w-10 text-[var(--theme-primary)]" />
      <h3 className="mt-3 font-extrabold text-[var(--theme-text-strong)]">
        Sẵn sàng mô phỏng
      </h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--theme-text-muted)]">
        Nhập câu hỏi như học sinh. Phản hồi sẽ đi qua đúng retrieval, prompt, policy và
        provider runtime đang dùng ở giao diện học sinh.
      </p>
    </div>
  );
}

function LoadingPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-center text-[var(--theme-primary)]",
        compact ? "min-h-20" : "min-h-60",
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
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

function readCapabilities(value: unknown): {
  features: string[];
  aiConfiguration: AdminAiConfigurationCapability;
  reasoningEffortLevels: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { features: [], aiConfiguration: null, reasoningEffortLevels: [] };
  }
  const object = value as Record<string, unknown>;
  const aiConfiguration =
    object.aiConfiguration === "TEMPERATURE" ||
    object.aiConfiguration === "REASONING_EFFORT" ||
    object.aiConfiguration === "NONE" ||
    object.aiConfiguration === null
      ? object.aiConfiguration
      : null;
  return {
    features: Array.isArray(object.features)
      ? object.features.filter((item): item is string => typeof item === "string")
      : [],
    aiConfiguration,
    reasoningEffortLevels: Array.isArray(object.reasoningEffortLevels)
      ? object.reasoningEffortLevels.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}
