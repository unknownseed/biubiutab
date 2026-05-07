export function requirePublicEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v || typeof v !== "string") {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

