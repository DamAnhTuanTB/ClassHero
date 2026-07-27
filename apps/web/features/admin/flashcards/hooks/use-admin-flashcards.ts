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
  type AdminFlashcardSetPayload,
} from "@/features/admin/flashcards/api/admin-flashcards-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

const flashcardSetsKey = (lessonId: string) =>
  ["admin-flashcard-sets", lessonId] as const;
const flashcardsKey = (setId: string) => ["admin-flashcards", setId] as const;

export function useAdminFlashcardSets(lessonId: string) {
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  return useQuery({
    queryKey: flashcardSetsKey(lessonId),
    queryFn: () => getAdminFlashcardSets(lessonId, requireToken(token)),
    enabled: Boolean(token && lessonId),
    staleTime: 30_000,
  });
}

export function useAdminFlashcardSetMutations(lessonId: string) {
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  const queryClient = useQueryClient();
  const invalidateSets = () =>
    queryClient.invalidateQueries({ queryKey: flashcardSetsKey(lessonId) });

  const createSet = useMutation({
    mutationFn: (payload: AdminFlashcardSetPayload) =>
      createAdminFlashcardSet(lessonId, payload, requireToken(token)),
    onSuccess: invalidateSets,
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
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  return useQuery({
    queryKey: flashcardsKey(setId),
    queryFn: () => getAdminFlashcards(setId, requireToken(token)),
    enabled: Boolean(token && setId),
    staleTime: 30_000,
  });
}

export function useAdminFlashcardMutations(setId: string, lessonId: string) {
  const token = useAuthSessionStore((state) => state.session?.accessToken);
  const queryClient = useQueryClient();
  const invalidateCards = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: flashcardsKey(setId) }),
      queryClient.invalidateQueries({ queryKey: flashcardSetsKey(lessonId) }),
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
