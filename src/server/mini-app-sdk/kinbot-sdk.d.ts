/**
 * KinBot Mini-App SDK — TypeScript Definitions
 * @version 1.16.0
 *
 * These types describe the global `KinBot` object auto-injected into mini-app iframes.
 * Import type reference: `/// <reference path="kinbot-sdk.d.ts" />`
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export interface KinBotTheme {
  mode: 'light' | 'dark';
  palette: string;
}

export interface KinBotAppMeta {
  id: string;
  name: string;
  slug: string;
  kinId: string;
  kinName: string;
  kinAvatarUrl: string | null;
  isFullPage: boolean;
  locale: string;
  user: KinBotUser;
}

export interface KinBotKin {
  id: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface KinBotUser {
  id: string | null;
  name: string | null;
  pseudonym: string | null;
  locale: string | null;
  timezone: string | null;
  avatarUrl: string | null;
}

export interface MiniAppInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  version: string | null;
}

export interface MemoryResult {
  id: string;
  content: string;
  category: string;
  subject: string | null;
  score: number;
  updatedAt: string;
}

export interface CreatedMemory {
  id: string;
  content: string;
  category: string;
  subject: string | null;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  sourceType: string;
}

export interface SharedData<T = unknown> {
  from: string;
  fromName: string;
  data: T;
  ts: number;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type EventName =
  | 'theme-changed'
  | 'app-meta'
  | 'locale-changed'
  | 'fullpage-changed'
  | 'shared-data'
  | string;

// ─── Storage ────────────────────────────────────────────────────────────────

export interface KinBotStorage {
  /** Get a value by key. Returns parsed value or null if not found. */
  get<T = unknown>(key: string): Promise<T | null>;
  /** Set a value for a key. Value must be JSON-serializable. */
  set(key: string, value: unknown): Promise<void>;
  /** Delete a key. Returns true if deleted, false if not found. */
  delete(key: string): Promise<boolean>;
  /** List all keys with their sizes. */
  list(): Promise<Array<{ key: string; size: number }>>;
  /** Clear all storage for this app. Returns number of keys cleared. */
  clear(): Promise<number>;
}

// ─── Backend API ────────────────────────────────────────────────────────────

export interface KinBotApi {
  /** Call a backend API route. Returns raw Response. */
  (path: string, options?: RequestInit): Promise<Response>;
  /** GET and parse JSON. */
  json<T = unknown>(path: string, headers?: Record<string, string>): Promise<T>;
  /** GET JSON shorthand. */
  get<T = unknown>(path: string, headers?: Record<string, string>): Promise<T>;
  /** POST JSON and parse response. */
  post<T = unknown>(path: string, data?: unknown): Promise<T>;
  /** PUT JSON and parse response. */
  put<T = unknown>(path: string, data?: unknown): Promise<T>;
  /** PATCH JSON and parse response. */
  patch<T = unknown>(path: string, data?: unknown): Promise<T>;
  /** DELETE and parse response. */
  delete<T = unknown>(path: string): Promise<T>;
}

// ─── HTTP Proxy ─────────────────────────────────────────────────────────────

export interface KinBotHttp {
  /** Fetch an external URL through server proxy (bypasses CORS). Returns raw Response. */
  (url: string, options?: RequestInit): Promise<Response>;
  /** GET external URL and parse JSON. */
  json<T = unknown>(url: string, headers?: Record<string, string>): Promise<T>;
  /** POST JSON to external URL and parse response. */
  post<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T>;
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

export interface KinBotClipboard {
  /** Copy text to system clipboard (bypasses iframe restrictions). */
  write(text: string): Promise<void>;
  /** Read text from system clipboard (may require permission). */
  read(): Promise<string>;
}

// ─── Events (SSE) ───────────────────────────────────────────────────────────

export interface KinBotEvents {
  /** Receive all SSE events from backend ctx.events.emit(). */
  subscribe(callback: (event: { event: string; data: unknown }) => void): void;
  /** Listen for a specific event name from backend. */
  on(eventName: string, callback: (data: unknown) => void): void;
  /** Disconnect the SSE stream. */
  close(): void;
  /** Whether the SSE connection is active. */
  readonly connected: boolean;
}

// ─── Apps ───────────────────────────────────────────────────────────────────

export interface KinBotApps {
  /** List all mini-apps from the same Kin. */
  list(): Promise<MiniAppInfo[]>;
  /** Get details of a specific mini-app by ID. */
  get(appId: string): Promise<MiniAppInfo>;
}

// ─── Memory ─────────────────────────────────────────────────────────────────

export interface KinBotMemory {
  /** Semantic search the Kin's memories. */
  search(query: string, limit?: number): Promise<MemoryResult[]>;
  /** Store a new memory for the Kin. */
  store(content: string, options?: { category?: 'fact' | 'preference' | 'decision' | 'knowledge'; subject?: string }): Promise<CreatedMemory>;
}

// ─── Conversation ───────────────────────────────────────────────────────────

export interface KinBotConversation {
  /** Get recent conversation messages. */
  history(limit?: number): Promise<ConversationMessage[]>;
  /** Send a message to the Kin's conversation. */
  send(text: string, options?: { silent?: boolean }): Promise<boolean>;
}

// ─── Main KinBot Object ────────────────────────────────────────────────────

export interface KinBot {
  /** Current theme (mode + palette). */
  readonly theme: KinBotTheme;
  /** Current app metadata. */
  readonly app: KinBotAppMeta | null;
  /** Info about the parent Kin. */
  readonly kin: KinBotKin;
  /** Info about the current user. */
  readonly user: KinBotUser;
  /** Whether the app is in full-page mode. */
  readonly isFullPage: boolean;
  /** Current UI language code (e.g. 'en', 'fr'). */
  readonly locale: string;
  /** SDK version string. */
  readonly version: string;

  // ─── Events ─────────────────────────────────────────────────────────
  /** Listen for events from the parent. */
  on(event: EventName, callback: (data: unknown) => void): void;
  /** Send events to the parent. */
  emit(event: string, data?: unknown): void;

  // ─── UI ─────────────────────────────────────────────────────────────
  /** Show a toast notification in the parent UI. */
  toast(message: string, type?: ToastType): void;
  /** Show a confirmation dialog. Returns true if confirmed. */
  confirm(message: string, options?: { title?: string; confirmText?: string; cancelText?: string }): Promise<boolean>;
  /** Show a prompt dialog. Returns entered text or null if cancelled. */
  prompt(message: string, options?: { title?: string; defaultValue?: string; placeholder?: string; confirmText?: string; cancelText?: string }): Promise<string | null>;
  /** Dynamically update the panel header title. */
  setTitle(title: string): void;
  /** Show a badge on the app in the sidebar. Pass null to clear. */
  setBadge(value: string | number | null): void;
  /** Open another mini-app from the same Kin by slug. */
  openApp(slug: string): void;
  /** Navigate the parent KinBot UI to a path. */
  navigate(path: string): void;

  // ─── Lifecycle ──────────────────────────────────────────────────────
  /** Signal that the app has finished loading. */
  ready(): void;
  /** Request full-page or side-panel mode. */
  fullpage(value: boolean): void;
  /** Request the parent panel to resize. Width: 320-1200px, Height: 200-2000px. */
  resize(width?: number, height?: number): void;

  // ─── Data ───────────────────────────────────────────────────────────
  /** Persistent key-value storage per app. */
  storage: KinBotStorage;
  /** Call backend API routes (_server.js). */
  api: KinBotApi;
  /** Fetch external URLs through server proxy (bypasses CORS). */
  http: KinBotHttp;
  /** System clipboard access. */
  clipboard: KinBotClipboard;
  /** Real-time SSE events from backend. */
  events: KinBotEvents;

  // ─── Communication ──────────────────────────────────────────────────
  /** Send a message to the Kin's conversation. */
  sendMessage(text: string, options?: { silent?: boolean }): Promise<boolean>;
  /** Browser notification via parent window. */
  notification(title: string, body?: string): Promise<boolean>;

  // ─── Namespaces ─────────────────────────────────────────────────────
  /** List and get mini-apps from the same Kin. */
  apps: KinBotApps;
  /** Search and store Kin memories. */
  memory: KinBotMemory;
  /** Read and send conversation messages. */
  conversation: KinBotConversation;

  // ─── Advanced ───────────────────────────────────────────────────────
  /** Register a keyboard shortcut. Returns unregister function. Pass null callback to remove. */
  shortcut(key: string, callback: ((e: KeyboardEvent) => void) | null): (() => void) | void;
  /** Share data with another mini-app by slug. */
  share(targetSlug: string, data: unknown): void;
  /** Trigger a file download. Supports string, object (auto-JSON), Blob, ArrayBuffer. */
  download(filename: string, content: string | object | Blob | ArrayBuffer, mimeType?: string): Promise<void>;
}

declare global {
  interface Window {
    KinBot: KinBot;
  }
  const KinBot: KinBot;
}
