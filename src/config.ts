function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    webhookSecret: required("WEBHOOK_SECRET"),
    fogbell: {
      apiUrl: required("FOGBELL_API_URL"),
      email: required("FOGBELL_EMAIL"),
      password: required("FOGBELL_PASSWORD"),
    },
    litellm: {
      baseUrl: required("LITELLM_BASE_URL"),
      apiKey: required("LITELLM_API_KEY"),
      model: process.env.LITELLM_MODEL || "gpt-4o",
    },
    notion: {
      token: required("NOTION_TOKEN"),
      databaseId: required("NOTION_DATABASE_ID"),
    },
    braveApiKey: process.env.BRAVE_API_KEY || "",
  };
}

export type Config = ReturnType<typeof getConfig>;
