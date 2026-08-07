"use client";

import type { AppState } from "@/domain/types";
import { buildDemoState } from "@/domain/demo-data";
import { getSupabaseMode } from "@/lib/supabase/config";

const STORAGE_KEY = "thriftwise-state-v1";
const STATE_TABLE = "thrift_state";

export interface ThriftRepository {
  load(): AppState | null | Promise<AppState | null>;
  save(state: AppState): void | Promise<void>;
  reset(): void | Promise<void>;
  mode: "supabase" | "demo";
}

class LocalRepository implements ThriftRepository {
  readonly mode = "demo" as const;

  load(): AppState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppState;
      if (!parsed?.thrift) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(state: AppState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }

  reset(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

class SupabaseRepository implements ThriftRepository {
  readonly mode = "supabase" as const;

  private async getTable() {
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    return getSupabaseClient().from(STATE_TABLE);
  }

  async load(): Promise<AppState | null> {
    try {
      const table = await this.getTable();
      const { data } = await table.select("state").eq("id", "main").maybeSingle();
      if (!data?.state) return null;
      return data.state as AppState;
    } catch {
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    try {
      const table = await this.getTable();
      await table.upsert({ id: "main", version: state.version, state, updated_at: new Date().toISOString() });
    } catch {
      /* offline */
    }
  }

  async reset(): Promise<void> {
    try {
      const table = await this.getTable();
      await table.delete().eq("id", "main");
    } catch {
      /* ignore */
    }
  }
}

export function getRepository(): ThriftRepository {
  if (getSupabaseMode() === "supabase") {
    return new SupabaseRepository();
  }
  return new LocalRepository();
}

export function seedDemoState(): AppState {
  return buildDemoState();
}
