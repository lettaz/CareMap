import { create } from "zustand";
import type { UIMessage } from "ai";

const STORAGE_PREFIX = "caremap-sessions";
const MAX_SESSIONS = 20;

export interface ChatSession {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionIndex {
  activeId: string | null;
  sessionIds: string[];
}

function indexKey(projectId: string) {
  return `${STORAGE_PREFIX}-index:${projectId}`;
}

function sessionKey(projectId: string, sessionId: string) {
  return `${STORAGE_PREFIX}:${projectId}:${sessionId}`;
}

function loadIndex(projectId: string): SessionIndex {
  try {
    const raw = localStorage.getItem(indexKey(projectId));
    if (!raw) return { activeId: null, sessionIds: [] };
    return JSON.parse(raw) as SessionIndex;
  } catch {
    return { activeId: null, sessionIds: [] };
  }
}

function saveIndex(projectId: string, index: SessionIndex) {
  try {
    localStorage.setItem(indexKey(projectId), JSON.stringify(index));
  } catch { /* quota */ }
}

function loadSession(projectId: string, sessionId: string): ChatSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(projectId, sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as ChatSession;
  } catch {
    return null;
  }
}

function saveSession(projectId: string, session: ChatSession) {
  try {
    localStorage.setItem(sessionKey(projectId, session.id), JSON.stringify(session));
  } catch { /* quota */ }
}

function deleteSessionStorage(projectId: string, sessionId: string) {
  try {
    localStorage.removeItem(sessionKey(projectId, sessionId));
  } catch { /* noop */ }
}

function migrateOldFormat(projectId: string): ChatSession | null {
  const oldKey = `caremap-chat:${projectId}`;
  try {
    const raw = localStorage.getItem(oldKey);
    if (!raw) return null;
    const messages = JSON.parse(raw) as UIMessage[];
    if (!messages.length) return null;

    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: deriveTitle(messages),
      messages,
      createdAt: Date.now() - 60_000,
      updatedAt: Date.now(),
    };
    localStorage.removeItem(oldKey);
    return session;
  } catch {
    return null;
  }
}

function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first?.parts) return "New Chat";

  for (const part of first.parts) {
    if (part.type === "text" && part.text) {
      const cleaned = part.text
        .replace(/@\[[^\]]+\]\([^)]+\)/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();
      if (cleaned.length > 0) {
        return cleaned.length > 50 ? cleaned.slice(0, 47) + "..." : cleaned;
      }
    }
  }
  return "New Chat";
}

interface ChatSessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  loadedProjectId: string | null;

  loadSessions: (projectId: string) => void;
  createSession: (projectId: string) => string;
  switchSession: (projectId: string, sessionId: string) => void;
  deleteSession: (projectId: string, sessionId: string) => void;
  updateMessages: (projectId: string, sessionId: string, messages: UIMessage[]) => void;
  getActiveSession: () => ChatSession | null;
  clearSession: (projectId: string, sessionId: string) => void;
}

export const useChatSessionStore = create<ChatSessionState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loadedProjectId: null,

  loadSessions: (projectId) => {
    const index = loadIndex(projectId);
    const sessions: ChatSession[] = [];

    const migrated = migrateOldFormat(projectId);
    if (migrated) {
      saveSession(projectId, migrated);
      if (!index.sessionIds.includes(migrated.id)) {
        index.sessionIds.unshift(migrated.id);
      }
      if (!index.activeId) index.activeId = migrated.id;
      saveIndex(projectId, index);
    }

    for (const sid of index.sessionIds) {
      const s = loadSession(projectId, sid);
      if (s) sessions.push(s);
    }

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    let activeId = index.activeId;
    if (!activeId || !sessions.some((s) => s.id === activeId)) {
      activeId = sessions[0]?.id ?? null;
    }

    set({ sessions, activeSessionId: activeId, loadedProjectId: projectId });
  },

  createSession: (projectId) => {
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveSession(projectId, session);

    const { sessions } = get();
    const newSessions = [session, ...sessions].slice(0, MAX_SESSIONS);

    const index = loadIndex(projectId);
    index.activeId = id;
    index.sessionIds = newSessions.map((s) => s.id);
    saveIndex(projectId, index);

    const removed = sessions.slice(MAX_SESSIONS - 1);
    for (const s of removed) deleteSessionStorage(projectId, s.id);

    set({ sessions: newSessions, activeSessionId: id });
    return id;
  },

  switchSession: (projectId, sessionId) => {
    const index = loadIndex(projectId);
    index.activeId = sessionId;
    saveIndex(projectId, index);
    set({ activeSessionId: sessionId });
  },

  deleteSession: (projectId, sessionId) => {
    deleteSessionStorage(projectId, sessionId);

    const { sessions, activeSessionId } = get();
    const filtered = sessions.filter((s) => s.id !== sessionId);

    let newActive = activeSessionId;
    if (activeSessionId === sessionId) {
      newActive = filtered[0]?.id ?? null;
    }

    const index = loadIndex(projectId);
    index.sessionIds = filtered.map((s) => s.id);
    index.activeId = newActive;
    saveIndex(projectId, index);

    set({ sessions: filtered, activeSessionId: newActive });
  },

  updateMessages: (projectId, sessionId, messages) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const needsTitleUpdate = session.title === "New Chat" && messages.length > 0;
    const updated: ChatSession = {
      ...session,
      messages,
      updatedAt: Date.now(),
      title: needsTitleUpdate ? deriveTitle(messages) : session.title,
    };

    saveSession(projectId, updated);

    set({
      sessions: sessions.map((s) => (s.id === sessionId ? updated : s)),
    });
  },

  clearSession: (projectId, sessionId) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const updated: ChatSession = {
      ...session,
      messages: [],
      updatedAt: Date.now(),
      title: "New Chat",
    };

    saveSession(projectId, updated);

    set({
      sessions: sessions.map((s) => (s.id === sessionId ? updated : s)),
    });
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
}));
