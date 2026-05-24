<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type Bookmark = {
  id: string
  categoryId: string
  name: string
  url: string
  sortOrder: number
}

type BookmarkTreeCategory = {
  id: string
  name: string
  sortOrder: number
  bookmarks: Array<Omit<Bookmark, 'categoryId'>>
}

type BookmarkTreeResponse = {
  data: BookmarkTreeCategory[]
}

type CategoryItem = {
  id: string
  name: string
  sortOrder: number
}

type FormError = {
  category?: string
  bookmark?: string
}

const rootUrl = (import.meta.env.VITE_ROOT_URL ?? import.meta.env.ROOT_URL ?? '').replace(/\/$/, '')
const isDev = import.meta.env.DEV

const isLoading = ref(false)
const isSubmitting = ref(false)
const loginToken = ref('')
const authToken = ref(sessionStorage.getItem('bookmark-cms-admin-token') ?? '')
const authError = ref<string | null>(null)
const globalMessage = ref<string | null>(null)
const globalError = ref<string | null>(null)
const formError = ref<FormError>({})

const categories = ref<BookmarkTreeCategory[]>([])

const newCategoryName = ref('')
const editingCategoryId = ref<string | null>(null)
const editingCategoryName = ref('')

const newBookmarkCategoryId = ref('')
const newBookmarkName = ref('')
const newBookmarkUrl = ref('')

const editingBookmarkId = ref<string | null>(null)
const editingBookmarkCategoryId = ref('')
const editingBookmarkName = ref('')
const editingBookmarkUrl = ref('')

const draggingCategoryId = ref<string | null>(null)
const draggingBookmark = ref<{ categoryId: string; bookmarkId: string } | null>(null)

const hasAuth = computed(() => Boolean(authToken.value))

const sortedCategories = computed(() =>
  [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
)

const bookmarkEditTarget = computed(() => {
  if (!editingBookmarkId.value) return null
  for (const category of categories.value) {
    const bookmark = category.bookmarks.find((item) => item.id === editingBookmarkId.value)
    if (bookmark) {
      return { category, bookmark }
    }
  }
  return null
})

const clearMessages = () => {
  globalMessage.value = null
  globalError.value = null
  formError.value = {}
}

/** API が返す英語メッセージを UI 向けに変換（サーバー設定ミスなど） */
const apiErrorMessageJa = (message: string): string => {
  const map: Record<string, string> = {
    'ADMIN_TOKEN is not configured':
      'API が ADMIN_TOKEN 未設定として応答しました。ダッシュボードに値がある場合は API（bookMarkSiteAPI）を再デプロイするか、値の前後に余計な空白がないか確認してください。',
  }
  return map[message] ?? message
}

const parseErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    const raw = body.error?.message ?? `HTTP ${response.status}`
    return apiErrorMessageJa(raw)
  } catch {
    return `HTTP ${response.status}`
  }
}

const apiFetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  if (!rootUrl && !isDev) {
    throw new Error('ROOT_URL が未設定です。')
  }

  const headers = new Headers(init?.headers ?? {})
  if (init?.body != null) {
    headers.set('Content-Type', 'application/json')
  }

  if (authToken.value && init?.method && init.method !== 'GET') {
    headers.set('Authorization', `Bearer ${authToken.value}`)
  }

  const response = await fetch(`${rootUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

const loadTree = async () => {
  clearMessages()
  isLoading.value = true
  try {
    const response = await apiFetch<BookmarkTreeResponse>('/api/bookmark-tree', { method: 'GET' })
    categories.value = response.data ?? []
    if (!newBookmarkCategoryId.value && response.data?.[0]) {
      newBookmarkCategoryId.value = response.data[0].id
    }
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'ブックマーク取得に失敗しました。'
  } finally {
    isLoading.value = false
  }
}

const submitLogin = async () => {
  clearMessages()
  if (!loginToken.value.trim()) {
    authError.value = 'トークンを入力してください。'
    return
  }
  authToken.value = loginToken.value.trim()
  sessionStorage.setItem('bookmark-cms-admin-token', authToken.value)
  loginToken.value = ''
  authError.value = null
  await loadTree()
}

const logout = () => {
  authToken.value = ''
  sessionStorage.removeItem('bookmark-cms-admin-token')
  categories.value = []
  editingCategoryId.value = null
  editingBookmarkId.value = null
  clearMessages()
}

const createCategory = async () => {
  clearMessages()
  if (!newCategoryName.value.trim()) {
    formError.value.category = 'カテゴリ名を入力してください。'
    return
  }

  isSubmitting.value = true
  try {
    await apiFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCategoryName.value.trim() }),
    })
    newCategoryName.value = ''
    globalMessage.value = 'カテゴリを追加しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'カテゴリ作成に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const startEditCategory = (category: CategoryItem) => {
  clearMessages()
  editingCategoryId.value = category.id
  editingCategoryName.value = category.name
}

const saveCategory = async (categoryId: string) => {
  clearMessages()
  if (!editingCategoryName.value.trim()) {
    formError.value.category = 'カテゴリ名を入力してください。'
    return
  }

  isSubmitting.value = true
  try {
    await apiFetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editingCategoryName.value.trim() }),
    })
    editingCategoryId.value = null
    editingCategoryName.value = ''
    globalMessage.value = 'カテゴリを更新しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'カテゴリ更新に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const deleteCategory = async (categoryId: string) => {
  clearMessages()
  isSubmitting.value = true
  try {
    await apiFetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
    globalMessage.value = 'カテゴリを削除しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'カテゴリ削除に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const createBookmark = async () => {
  clearMessages()
  if (!newBookmarkCategoryId.value || !newBookmarkName.value.trim() || !newBookmarkUrl.value.trim()) {
    formError.value.bookmark = 'カテゴリ・名前・URLを入力してください。'
    return
  }

  isSubmitting.value = true
  try {
    await apiFetch('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: newBookmarkCategoryId.value,
        name: newBookmarkName.value.trim(),
        url: newBookmarkUrl.value.trim(),
      }),
    })
    newBookmarkName.value = ''
    newBookmarkUrl.value = ''
    globalMessage.value = 'ブックマークを追加しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'ブックマーク作成に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const startEditBookmark = (categoryId: string, bookmark: Omit<Bookmark, 'categoryId'>) => {
  clearMessages()
  editingBookmarkId.value = bookmark.id
  editingBookmarkCategoryId.value = categoryId
  editingBookmarkName.value = bookmark.name
  editingBookmarkUrl.value = bookmark.url
}

const saveBookmark = async (bookmarkId: string) => {
  clearMessages()
  if (!editingBookmarkCategoryId.value || !editingBookmarkName.value.trim() || !editingBookmarkUrl.value.trim()) {
    formError.value.bookmark = 'カテゴリ・名前・URLを入力してください。'
    return
  }

  isSubmitting.value = true
  try {
    await apiFetch(`/api/bookmarks/${bookmarkId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        categoryId: editingBookmarkCategoryId.value,
        name: editingBookmarkName.value.trim(),
        url: editingBookmarkUrl.value.trim(),
      }),
    })
    editingBookmarkId.value = null
    globalMessage.value = 'ブックマークを更新しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'ブックマーク更新に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const deleteBookmark = async (bookmarkId: string) => {
  clearMessages()
  isSubmitting.value = true
  try {
    await apiFetch(`/api/bookmarks/${bookmarkId}`, { method: 'DELETE' })
    globalMessage.value = 'ブックマークを削除しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'ブックマーク削除に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

const cancelEdits = () => {
  editingCategoryId.value = null
  editingBookmarkId.value = null
  editingCategoryName.value = ''
  editingBookmarkName.value = ''
  editingBookmarkUrl.value = ''
  clearMessages()
}

const updateCategoryOrder = async (items: CategoryItem[]) => {
  await apiFetch('/api/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({
      items: items.map((item, index) => ({ id: item.id, sortOrder: (index + 1) * 10 })),
    }),
  })
}

const updateBookmarkOrder = async (categoryId: string, items: Array<Omit<Bookmark, 'categoryId'>>) => {
  await apiFetch(`/api/categories/${categoryId}/bookmarks/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({
      items: items.map((item, index) => ({ id: item.id, sortOrder: (index + 1) * 10 })),
    }),
  })
}

const onCategoryDragStart = (categoryId: string) => {
  draggingCategoryId.value = categoryId
}

const onCategoryDrop = async (targetCategoryId: string) => {
  if (!draggingCategoryId.value || draggingCategoryId.value === targetCategoryId) return

  clearMessages()
  isSubmitting.value = true
  try {
    const reordered = [...sortedCategories.value]
    const fromIndex = reordered.findIndex((item) => item.id === draggingCategoryId.value)
    const toIndex = reordered.findIndex((item) => item.id === targetCategoryId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = reordered.splice(fromIndex, 1)
    if (!moved) return
    reordered.splice(toIndex, 0, moved)
    await updateCategoryOrder(reordered)
    globalMessage.value = 'カテゴリ順を更新しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'カテゴリ並び替えに失敗しました。'
  } finally {
    draggingCategoryId.value = null
    isSubmitting.value = false
  }
}

const onBookmarkDragStart = (categoryId: string, bookmarkId: string) => {
  draggingBookmark.value = { categoryId, bookmarkId }
}

const onBookmarkDrop = async (targetCategoryId: string, targetBookmarkId: string) => {
  if (!draggingBookmark.value) return
  const source = draggingBookmark.value
  if (source.categoryId !== targetCategoryId || source.bookmarkId === targetBookmarkId) return

  clearMessages()
  isSubmitting.value = true
  try {
    const category = categories.value.find((item) => item.id === targetCategoryId)
    if (!category) return
    const reordered = [...category.bookmarks]
    const fromIndex = reordered.findIndex((item) => item.id === source.bookmarkId)
    const toIndex = reordered.findIndex((item) => item.id === targetBookmarkId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = reordered.splice(fromIndex, 1)
    if (!moved) return
    reordered.splice(toIndex, 0, moved)
    await updateBookmarkOrder(targetCategoryId, reordered)
    globalMessage.value = 'ブックマーク順を更新しました。'
    await loadTree()
  } catch (error) {
    globalError.value = error instanceof Error ? error.message : 'ブックマーク並び替えに失敗しました。'
  } finally {
    draggingBookmark.value = null
    isSubmitting.value = false
  }
}

onMounted(async () => {
  if (hasAuth.value) {
    await loadTree()
  }
})
</script>

<template>
  <main class="cms-shell">
    <section v-if="!hasAuth" class="auth-card">
      <h1>Bookmark CMS ログイン</h1>
      <p>管理トークンを入力すると編集機能を有効化します。</p>
      <input v-model="loginToken" type="password" placeholder="ADMIN_TOKEN" @keyup.enter="submitLogin" />
      <button type="button" @click="submitLogin">ログイン</button>
      <p v-if="authError" class="error-text">{{ authError }}</p>
      <p v-if="!rootUrl && !isDev" class="error-text">
        ROOT_URL が .env に設定されていません。
      </p>
    </section>

    <section v-else class="cms-card">
      <header class="cms-header">
        <h1>Bookmark CMS</h1>
        <div class="header-actions">
          <button type="button" @click="loadTree">再読み込み</button>
          <button type="button" class="danger" @click="logout">ログアウト</button>
        </div>
      </header>

      <p v-if="globalMessage" class="success-text">{{ globalMessage }}</p>
      <p v-if="globalError" class="error-text">{{ globalError }}</p>

      <section class="form-block">
        <h2>カテゴリ追加</h2>
        <div class="inline-form">
          <input v-model="newCategoryName" type="text" placeholder="カテゴリ名" />
          <button type="button" :disabled="isSubmitting" @click="createCategory">追加</button>
        </div>
      </section>

      <section class="form-block">
        <h2>ブックマーク追加</h2>
        <div class="inline-form multi">
          <select v-model="newBookmarkCategoryId">
            <option value="" disabled>カテゴリを選択</option>
            <option v-for="category in sortedCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <input v-model="newBookmarkName" type="text" placeholder="ブックマーク名" />
          <input v-model="newBookmarkUrl" type="url" placeholder="https://example.com" />
          <button type="button" :disabled="isSubmitting" @click="createBookmark">追加</button>
        </div>
      </section>

      <p v-if="formError.category || formError.bookmark" class="error-text">
        {{ formError.category ?? formError.bookmark }}
      </p>

      <p v-if="isLoading">読み込み中...</p>

      <section
        v-for="category in sortedCategories"
        :key="category.id"
        class="category-card"
        draggable="true"
        @dragstart="onCategoryDragStart(category.id)"
        @dragover.prevent
        @drop="onCategoryDrop(category.id)"
      >
        <div class="category-header">
          <template v-if="editingCategoryId === category.id">
            <input v-model="editingCategoryName" type="text" />
            <button type="button" :disabled="isSubmitting" @click="saveCategory(category.id)">保存</button>
            <button type="button" @click="cancelEdits">キャンセル</button>
          </template>
          <template v-else>
            <h3>{{ category.name }}</h3>
            <div class="header-actions">
              <button type="button" @click="startEditCategory(category)">編集</button>
              <button type="button" class="danger" @click="deleteCategory(category.id)">削除</button>
            </div>
          </template>
        </div>
        <p class="hint-text">カテゴリ全体をドラッグすると順序変更できます。</p>

        <ul class="bookmark-list">
          <li
            v-for="bookmark in category.bookmarks"
            :key="bookmark.id"
            class="bookmark-item"
            draggable="true"
            @dragstart="onBookmarkDragStart(category.id, bookmark.id)"
            @dragover.prevent
            @drop="onBookmarkDrop(category.id, bookmark.id)"
          >
            <template v-if="editingBookmarkId === bookmark.id">
              <select v-model="editingBookmarkCategoryId">
                <option v-for="item in sortedCategories" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
              <input v-model="editingBookmarkName" type="text" />
              <input v-model="editingBookmarkUrl" type="url" />
              <div class="item-actions">
                <button type="button" :disabled="isSubmitting" @click="saveBookmark(bookmark.id)">保存</button>
                <button type="button" @click="cancelEdits">キャンセル</button>
              </div>
            </template>
            <template v-else>
              <div class="bookmark-main">
                <strong>{{ bookmark.name }}</strong>
                <a :href="bookmark.url" target="_blank" rel="noreferrer">{{ bookmark.url }}</a>
              </div>
              <div class="item-actions">
                <button type="button" @click="startEditBookmark(category.id, bookmark)">編集</button>
                <button type="button" class="danger" @click="deleteBookmark(bookmark.id)">削除</button>
              </div>
            </template>
          </li>
        </ul>
        <p class="hint-text">同カテゴリ内のブックマークはドラッグで順序変更できます。</p>
      </section>

      <section v-if="bookmarkEditTarget" class="form-block">
        <h2>移動メモ</h2>
        <p>
          別カテゴリへ移動する場合は、対象ブックマークを「編集」してカテゴリを変更してください。
        </p>
      </section>
    </section>
  </main>
</template>
