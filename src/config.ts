export type Environment = Record<string, string | boolean | undefined>;

export function readConfig(env: Environment) {
  const mode = env.VITE_MODE || "demo";
  if (mode !== "demo" && mode !== "aws") {
    throw Error("VITE_MODE must be demo or aws.");
  }
  if (mode === "demo") {
    return {
      demo: true as const,
      domain: String(env.VITE_CAMPUS_DOMAIN || "campus.edu"),
    };
  }
  const required = [
    "VITE_CAMPUS_DOMAIN",
    "VITE_API_URL",
    "VITE_USER_POOL_ID",
    "VITE_USER_POOL_CLIENT_ID",
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length)
    throw Error(`Cloud configuration is missing: ${missing.join(", ")}`);
  const apiUrl = String(env.VITE_API_URL).replace(/\/+$/, "");
  if (!apiUrl.startsWith("https://"))
    throw Error("The cloud API URL must use HTTPS.");
  return {
    demo: false as const,
    domain: String(env.VITE_CAMPUS_DOMAIN).toLowerCase(),
    apiUrl,
    userPoolId: String(env.VITE_USER_POOL_ID),
    userPoolClientId: String(env.VITE_USER_POOL_CLIENT_ID),
  };
}
