"use client";
import { useState } from "react";
import { Button } from "@base-ui-components/react/button";
import { Folder, Plus, MoreHorizontal, ChevronDown } from "lucide-react";
import type { Project } from "@/lib/domain";
import type { ProjectFolder } from "@/lib/project-folders";
export function ProjectHistory({
  chats,
  folders,
  active,
  selected,
  busy,
  onChat,
  onFolder,
  onCreate,
  onAssign,
  onRename,
}: {
  chats: Project[];
  folders: ProjectFolder[];
  active: string;
  selected: string;
  busy: boolean;
  onChat: (id: string) => void;
  onFolder: (id: string) => void;
  onCreate: (description: string) => Promise<void>;
  onAssign: (chat: string, folder: string | null) => Promise<void>;
  onRename: (folder: string, title: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false),
    [description, setDescription] = useState(""),
    [saving, setSaving] = useState(false),
    [dragOver, setDragOver] = useState(""),
    [rename, setRename] = useState(""),
    [title, setTitle] = useState("");
  const chatRow = (chat: Project) => (
    <div
      key={chat.id}
      className={`historyChat ${active === chat.id && !selected ? "active" : ""}`}
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/roomwise-chat", chat.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <Button
        disabled={busy}
        onClick={() => onChat(chat.id)}
        title={chat.title}
      >
        <span>{chat.title || "New chat"}</span>
      </Button>
      <details className="chatAssign">
        <summary aria-label={`Organize ${chat.title}`}>
          <MoreHorizontal size={15} />
        </summary>
        <div>
          <label>
            Move to project
            <select
              aria-label={`Project for ${chat.title}`}
              value={chat.folderId || ""}
              disabled={busy}
              onChange={(e) => void onAssign(chat.id, e.target.value || null)}
            >
              <option value="">No project</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
  return (
    <div className="projectList organizedHistory">
      <div className="historySectionHead">
        <small>Projects</small>
        <Button
          aria-label="Create project folder"
          disabled={busy}
          onClick={() => setCreating(!creating)}
        >
          <Plus size={15} />
        </Button>
      </div>
      {creating && (
        <form
          className="newFolderForm"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true);
            try {
              await onCreate(description);
              setCreating(false);
              setDescription("");
            } finally {
              setSaving(false);
            }
          }}
        >
          <input
            autoFocus
            placeholder="What is this project?"
            aria-label="Project description"
            required
            minLength={2}
            maxLength={900}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button disabled={saving || busy} type="submit">
            {saving ? "Creating…" : "Create project"}
          </Button>
        </form>
      )}
      {folders.map((folder) => (
        <details
          key={folder.id}
          open
          className={`historyFolder ${dragOver === folder.id ? "dropTarget" : ""}`}
          onDragOver={(e) => {
            if (
              !busy &&
              e.dataTransfer.types.includes("application/roomwise-chat")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOver(folder.id);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragOver("");
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver("");
            const id = e.dataTransfer.getData("application/roomwise-chat");
            if (id && !busy) void onAssign(id, folder.id);
          }}
        >
          <summary>
            <ChevronDown size={12} />
            <Button
              className={selected === folder.id ? "active" : ""}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onFolder(folder.id);
              }}
            >
              <Folder size={15} />
              <span>{folder.title}</span>
            </Button>
            <Button
              aria-label={`Rename ${folder.title}`}
              onClick={(e) => {
                e.preventDefault();
                setRename(folder.id);
                setTitle(folder.title);
              }}
            >
              <MoreHorizontal size={14} />
            </Button>
          </summary>
          {rename === folder.id && (
            <form
              className="newFolderForm"
              onSubmit={async (e) => {
                e.preventDefault();
                await onRename(folder.id, title);
                setRename("");
              }}
            >
              <input
                aria-label="Project title"
                required
                maxLength={65}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Button type="submit">Save name</Button>
            </form>
          )}
          <div className="folderChats">
            {chats.filter((chat) => chat.folderId === folder.id).map(chatRow)}
            {!chats.some((chat) => chat.folderId === folder.id) && (
              <small>Drop a chat here</small>
            )}
          </div>
        </details>
      ))}
      <div className="historySectionHead">
        <small>Chats</small>
      </div>
      {chats.filter((chat) => !chat.folderId).map(chatRow)}
    </div>
  );
}
