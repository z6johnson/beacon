import { Client } from "@notionhq/client";
import type { Config } from "../config.js";

export function createNotionClient(config: Config) {
  return new Client({ auth: config.notion.token });
}
