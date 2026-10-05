import { briefSchema } from "./domain";
import type { Project } from "./domain";
export function readProjects(key = "roomwise:local-projects"): Project[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (p) =>
          typeof p?.id === "string" &&
          briefSchema.safeParse(p.brief).success &&
          Array.isArray(p.messages) &&
          p.messages.every(
            (m: any) =>
              ["user", "assistant"].includes(m?.role) &&
              typeof m.content === "string",
          ) &&
          typeof p.title === "string",
      )
      .slice(0, 50)
      .map((p) =>
        key === "roomwise:local-projects"
          ? { ...p, paid: false, storage: "browser" }
          : p,
      );
  } catch {
    return [];
  }
}
export function writeProjects(
  projects: Project[],
  key = "roomwise:local-projects",
) {
  localStorage.setItem(key, JSON.stringify(projects.slice(0, 50)));
}
export async function api(path: string, body?: unknown) {
  const r = await fetch(path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "This action is temporarily unavailable.");
  return data;
}
