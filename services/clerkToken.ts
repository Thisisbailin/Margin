export const getEnvValue = (key: string): string | undefined => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key];
  } catch {}

  try {
    if ((globalThis as any).process?.env?.[key]) return (globalThis as any).process.env[key];
  } catch {}

  return undefined;
};

export const getClerkJwtTemplate = () => getEnvValue('VITE_CLERK_JWT_TEMPLATE');

export const fetchClerkToken = async (
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<string | null> => {
  const template = getClerkJwtTemplate();
  if (template) {
    return getToken({ template });
  }
  return getToken();
};
