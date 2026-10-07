import { randomUUID } from "node:crypto";
import type { Queryable } from "./repository";
import { projectAssets } from "./project-assets";
export type ProjectFolder = {
  id: string;
  title: string;
  description: string;
  title_status: string;
};
export async function listFolders(db: Queryable, owner: string) {
  return (
    await db.query(
      "SELECT id,title,description,title_status FROM roomwise.project_folders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [owner],
    )
  ).rows as ProjectFolder[];
}
export async function createFolder(
  db: Queryable,
  owner: string,
  description: string,
) {
  return (
    await db.query(
      "INSERT INTO roomwise.project_folders(id,user_id,title,description) VALUES($1,$2,$3,$4) RETURNING id,title,description,title_status",
      [randomUUID(), owner, description.slice(0, 60), description],
    )
  ).rows[0] as ProjectFolder;
}
export async function assignChat(
  db: Queryable,
  owner: string,
  chat: string,
  folder: string | null,
) {
  return (
    (
      await db.query(
        `UPDATE roomwise.projects SET folder_id=$3 WHERE id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM roomwise.project_folders WHERE id=$3 AND user_id=$2)) RETURNING id`,
        [chat, owner, folder],
      )
    ).rows.length === 1
  );
}
export async function folderAssets(db: Queryable, owner: string, id: string) {
  const folder = (
    await db.query(
      "SELECT id,title,description,title_status FROM roomwise.project_folders WHERE id=$1 AND user_id=$2",
      [id, owner],
    )
  ).rows[0];
  if (!folder) return null;
  const chats = (
    await db.query(
      "SELECT id,title,paid,updated_at FROM roomwise.projects WHERE folder_id=$1 AND user_id=$2 ORDER BY updated_at DESC",
      [id, owner],
    )
  ).rows;
  const feeds = await Promise.all(
    chats.map((chat) => projectAssets(db, owner, chat.id)),
  );
  return {
    folder,
    chats,
    artifacts: feeds.flatMap((feed) => feed?.artifacts || []),
  };
}
