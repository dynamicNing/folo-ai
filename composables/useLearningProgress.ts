import { computed, ref, unref, watch, type Ref } from 'vue'

const STORAGE_PREFIX = 'learn-progress:'

function storageKey(topicSlug: string): string {
  return `${STORAGE_PREFIX}${topicSlug}`
}

function normalizeChapterList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => String(item).trim()).filter(Boolean)))
}

export function readLearningProgress(topicSlug: string): string[] {
  if (!import.meta.client || !topicSlug) return []
  try {
    const raw = localStorage.getItem(storageKey(topicSlug))
    if (!raw) return []
    return normalizeChapterList(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLearningProgress(topicSlug: string, completed: string[]): void {
  if (!import.meta.client || !topicSlug) return
  localStorage.setItem(storageKey(topicSlug), JSON.stringify(normalizeChapterList(completed)))
}

export function useLearningProgress(topicSlug: string | Ref<string>) {
  const completed = ref<string[]>([])
  const loaded = ref(false)
  const currentTopicSlug = computed(() => unref(topicSlug))

  function reload(): void {
    completed.value = readLearningProgress(currentTopicSlug.value)
    loaded.value = true
  }

  function setChapterCompleted(chapterSlug: string, done: boolean): void {
    const next = new Set(completed.value)
    if (done) next.add(chapterSlug)
    else next.delete(chapterSlug)
    completed.value = Array.from(next)
    writeLearningProgress(currentTopicSlug.value, completed.value)
  }

  function toggleChapterCompleted(chapterSlug: string): void {
    setChapterCompleted(chapterSlug, !completed.value.includes(chapterSlug))
  }

  function isCompleted(chapterSlug: string): boolean {
    return completed.value.includes(chapterSlug)
  }

  watch(currentTopicSlug, reload, { immediate: true })

  return {
    completed,
    completedCount: computed(() => completed.value.length),
    loaded,
    reload,
    isCompleted,
    setChapterCompleted,
    toggleChapterCompleted,
  }
}
