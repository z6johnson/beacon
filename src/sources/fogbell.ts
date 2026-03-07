import { logger } from "../lib/logger.js";
import type { Config } from "../config.js";

export interface FogBellSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  relevanceScore: number;
  topics: string[];
  publishedAt: string;
  institutions?: string[];
}

export interface FogBellStoryline {
  id: string;
  title: string;
  summary: string;
  signalCount: number;
  signals: FogBellSignal[];
  updatedAt: string;
}

interface AuthResponse {
  token: string;
}

export class FogBellClient {
  private config: Config["fogbell"];
  private token: string | null = null;

  constructor(config: Config["fogbell"]) {
    this.config = config;
  }

  private async authenticate(): Promise<string> {
    if (this.token) return this.token;

    logger.info("Authenticating with FogBell");
    const res = await fetch(`${this.config.apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!res.ok) {
      throw new Error(`FogBell auth failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as AuthResponse;
    this.token = data.token;
    return this.token;
  }

  private async authFetch(path: string): Promise<Response> {
    const token = await this.authenticate();
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`FogBell ${path} failed: ${res.status} ${res.statusText}`);
    }

    return res;
  }

  async getSignals(): Promise<FogBellSignal[]> {
    logger.info("Fetching signals from FogBell");
    const res = await this.authFetch("/api/signals");
    const data = await res.json();
    const signals = (Array.isArray(data) ? data : data.signals ?? []) as FogBellSignal[];
    logger.info("Fetched signals", { count: signals.length });
    return signals;
  }

  async getStorylines(): Promise<FogBellStoryline[]> {
    logger.info("Fetching storylines from FogBell");
    const res = await this.authFetch("/api/storylines");
    const data = await res.json();
    const storylines = (Array.isArray(data) ? data : data.storylines ?? []) as FogBellStoryline[];
    logger.info("Fetched storylines", { count: storylines.length });
    return storylines;
  }
}
