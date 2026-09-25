// 本地保存模块：与授权、会谈、台账逻辑完全分开。
// 仅负责读写浏览器 localStorage；三类数据使用三个独立仓库（独立 key）。

export interface Repository<T extends { id: string }> {
  readonly storageKey: string;
  load(): T[];
  save(items: T[]): void;
  clear(): void;
}

const PREFIX = "hxwl-12.ledger.";

export function createRepository<T extends { id: string }>(name: string): Repository<T> {
  const storageKey = PREFIX + name;
  return {
    storageKey,
    load() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    },
    save(items: T[]) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    },
    clear() {
      localStorage.removeItem(storageKey);
    },
  };
}

/** 本地保存状态总览（用于界面展示三个仓库是分开的） */
export interface StorageStat {
  storageKey: string;
  count: number;
  bytes: number;
}

export function statRepository<T extends { id: string }>(repo: Repository<T>): StorageStat {
  const items = repo.load();
  const raw = localStorage.getItem(repo.storageKey);
  return {
    storageKey: repo.storageKey,
    count: items.length,
    bytes: raw ? new Blob([raw]).size : 0,
  };
}
