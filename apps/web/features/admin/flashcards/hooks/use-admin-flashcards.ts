import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminFlashcard,
  createAdminFlashcardSet,
  deleteAdminFlashcard,
  deleteAdminFlashcardSet,
  getAdminFlashcards,
  getAdminFlashcardSets,
  updateAdminFlashcard,
  updateAdminFlashcardSet,
  type AdminFlashcardPayload,
  type AdminFlashcardSet,
  type AdminFlashcardSetPayload,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

const adminFlashcardQueryKeys = {
  all: ["admin", "flashcards"] as const,
  sets: (lessonId: string) => [...adminFlashcardQueryKeys.all, "sets", lessonId] as const,
  setsForUser: (lessonId: string, userId?: string) =>
    [...adminFlashcardQueryKeys.sets(lessonId), userId ?? "guest"] as const,
  cards: (setId: string) => [...adminFlashcardQueryKeys.all, "cards", setId] as const,
  cardsForUser: (setId: string, userId?: string) =>
    [...adminFlashcardQueryKeys.cards(setId), userId ?? "guest"] as const,
};

export function getAdminFlashcardSetsQueryOptions({
  accessToken,
  lessonId,
  userId,
}: {
  accessToken: string;
  lessonId: string;
  userId?: string;
}) {
  return {
    queryKey: adminFlashcardQueryKeys.setsForUser(lessonId, userId),
    queryFn: () => getAdminFlashcardSets(lessonId, accessToken),
    staleTime: 30_000,
  };
}

export function getAdminFlashcardsQueryOptions({
  accessToken,
  setId,
  userId,
}: {
  accessToken: string;
  setId: string;
  userId?: string;
}) {
  return {
    queryKey: adminFlashcardQueryKeys.cardsForUser(setId, userId),
    queryFn: () => getAdminFlashcards(setId, accessToken),
    staleTime: 30_000,
  };
}

export function useAdminFlashcardSets(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    ...getAdminFlashcardSetsQueryOptions({
      accessToken: session?.accessToken ?? "",
      lessonId,
      userId: session?.user.id,
    }),
    enabled: Boolean(session?.accessToken && lessonId),
  });
}

export function useAdminFlashcardSetMutations(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken;
  const queryClient = useQueryClient();
  const invalidateSets = () =>
    queryClient.invalidateQueries({
      queryKey: adminFlashcardQueryKeys.sets(lessonId),
    });

  const createSet = useMutation({
    mutationFn: (payload: AdminFlashcardSetPayload) =>
      createAdminFlashcardSet(lessonId, payload, requireToken(token)),
    onSuccess: (createdSet) => {
      queryClient.setQueryData<AdminFlashcardSet[]>(
        adminFlashcardQueryKeys.setsForUser(lessonId, session?.user.id),
        (currentSets) => [...(currentSets ?? []), createdSet],
      );
      void invalidateSets();
    },
  });
  const updateSet = useMutation({
    mutationFn: ({
      payload,
      setId,
    }: {
      payload: AdminFlashcardSetPayload;
      setId: string;
    }) => updateAdminFlashcardSet(setId, payload, requireToken(token)),
    onSuccess: invalidateSets,
  });
  const deleteSet = useMutation({
    mutationFn: (setId: string) => deleteAdminFlashcardSet(setId, requireToken(token)),
    onSuccess: invalidateSets,
  });

  return { createSet, deleteSet, updateSet };
}

export function useAdminFlashcards(setId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    ...getAdminFlashcardsQueryOptions({
      accessToken: session?.accessToken ?? "",
      setId,
      userId: session?.user.id,
    }),
    enabled: Boolean(session?.accessToken && setId),
  });
}

export function useAdminFlashcardMutations(setId: string, lessonId: string) {
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  const queryClient = useQueryClient();
  const invalidateCards = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminFlashcardQueryKeys.cards(setId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminFlashcardQueryKeys.sets(lessonId),
      }),
    ]);

  const createCard = useMutation({
    mutationFn: (payload: AdminFlashcardPayload) =>
      createAdminFlashcard(setId, payload, requireToken(token)),
    onSuccess: invalidateCards,
  });
  const updateCard = useMutation({
    mutationFn: ({
      flashcardId,
      payload,
    }: {
      flashcardId: string;
      payload: AdminFlashcardPayload;
    }) => updateAdminFlashcard(flashcardId, payload, requireToken(token)),
    onSuccess: invalidateCards,
  });
  const deleteCard = useMutation({
    mutationFn: (flashcardId: string) =>
      deleteAdminFlashcard(flashcardId, requireToken(token)),
    onSuccess: invalidateCards,
  });

  return { createCard, deleteCard, updateCard };
}

function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("Phiên đăng nhập đã hết hạn");
  }
  return token;
}
