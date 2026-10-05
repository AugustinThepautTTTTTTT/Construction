import { randomUUID } from "node:crypto";
import type { Brief, Message, Project } from "./domain";
export const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS roomwise;
CREATE TABLE IF NOT EXISTS roomwise.users(id uuid PRIMARY KEY, email text UNIQUE, pro_active boolean NOT NULL DEFAULT false, subscription_id text UNIQUE, billing_event_at bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS roomwise.sessions(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES roomwise.users(id), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS roomwise.magic_links(token_hash text PRIMARY KEY,email text NOT NULL,guest_id uuid REFERENCES roomwise.users(id),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS roomwise.projects(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES roomwise.users(id),title text NOT NULL,brief jsonb NOT NULL,messages jsonb NOT NULL DEFAULT '[]',paid boolean NOT NULL DEFAULT false,preview_used boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS roomwise_projects_owner ON roomwise.projects(user_id,updated_at);
CREATE TABLE IF NOT EXISTS roomwise.stripe_events(id text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS roomwise.rate_limits(key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
`;
type Result = { rows: Record<string, any>[] };
export type Queryable = {
  query: (text: string, values?: any[]) => Promise<Result>;
};
function project(row: Record<string, any>): Project {
  return {
    storage: "cloud",
    id: row.id,
    title: row.title,
    brief: row.brief,
    messages: row.messages,
    paid: row.paid,
    previewUsed: row.preview_used,
    updated_at: new Date(row.updated_at).toISOString(),
  };
}
export class ProjectRepository {
  constructor(readonly db: Queryable) {}
  async create(owner: string, brief: Brief) {
    const id = randomUUID();
    const r = await this.db.query(
      "INSERT INTO roomwise.projects(id,user_id,title,brief) VALUES($1,$2,$3,$4::jsonb) RETURNING *",
      [
        id,
        owner,
        `${brief.room}: ${brief.goal.slice(0, 60)}`,
        JSON.stringify(brief),
      ],
    );
    return project(r.rows[0]);
  }
  async list(owner: string) {
    const r = await this.db.query(
      "SELECT * FROM roomwise.projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50",
      [owner],
    );
    return r.rows.map(project);
  }
  async get(owner: string, id: string) {
    const r = await this.db.query(
      "SELECT * FROM roomwise.projects WHERE id=$1 AND user_id=$2",
      [id, owner],
    );
    return r.rows[0] ? project(r.rows[0]) : null;
  }
  async append(owner: string, id: string, messages: Message[]) {
    const r = await this.db.query(
      "UPDATE roomwise.projects SET messages=messages || $1::jsonb,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING *",
      [JSON.stringify(messages), id, owner],
    );
    return r.rows[0] ? project(r.rows[0]) : null;
  }
  async claimPreview(owner: string, id: string) {
    const r = await this.db.query(
      "UPDATE roomwise.projects SET preview_used=true WHERE id=$1 AND user_id=$2 AND preview_used=false RETURNING id",
      [id, owner],
    );
    return r.rows.length > 0;
  }
  async grant(
    eventId: string,
    g: { plan: "single" | "pro"; ownerId: string; projectId: string },
    subscriptionId?: string,
    created = 0,
    active = true,
  ) {
    // Caller supplies a transaction-scoped connection. The owner and event checks are in SQL.
    const exists = await this.db.query(
      "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",
      [g.projectId, g.ownerId],
    );
    if (!exists.rows.length) return false;
    const event = await this.db.query(
      "INSERT INTO roomwise.stripe_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
      [eventId],
    );
    if (!event.rows.length) return false;
    if (g.plan === "single")
      await this.db.query(
        "UPDATE roomwise.projects SET paid=true WHERE id=$1 AND user_id=$2",
        [g.projectId, g.ownerId],
      );
    else
      await this.db.query(
        "UPDATE roomwise.users SET pro_active=$4,subscription_id=$1,billing_event_at=$3 WHERE id=$2 AND billing_event_at<=$3",
        [subscriptionId, g.ownerId, created, active],
      );
    return true;
  }
}
