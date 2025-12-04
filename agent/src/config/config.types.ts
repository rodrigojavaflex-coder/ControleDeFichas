export interface AgentDbConfig {
  host: string;
  port: number;
  path: string;
  user: string;
  password: string;
  role?: string;
  charset?: string;
}

export interface AgentConfig {
  port: number;
  authToken: string;
  authTokenFallbacks: string[];
  allowedIps: string[];
  rateLimit: {
    ttl: number;
    limit: number;
  };
  db: AgentDbConfig;
}
