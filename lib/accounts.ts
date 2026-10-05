import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { Queryable } from "./repository";
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, options, (e, key) =>
      e ? reject(e) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
) {
  const parts = (encoded || "").split("$");
  const valid =
    parts.length === 3 &&
    parts[0] === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  const actual = await derive(
    password,
    valid ? parts[1] : "00000000000000000000000000000000",
  );
  const expected = Buffer.from(valid ? parts[2] : "00".repeat(64), "hex");
  return timingSafeEqual(actual, expected) && valid;
}
export class AccountRepository {
  constructor(readonly db: Queryable) {}
  async credentials(email: string) {
    const r = await this.db.query(
      "SELECT id,email,name,password_hash FROM roomwise.users WHERE email=$1",
      [email],
    );
    return r.rows[0] || null;
  }
  async register(
    email: string,
    name: string,
    passwordHash: string,
    guestId: string | null,
  ) {
    if (guestId) {
      const r = await this.db.query(
        "UPDATE roomwise.users SET email=$1,name=$2,password_hash=$3 WHERE id=$4 AND email IS NULL RETURNING id,email,name",
        [email, name, passwordHash, guestId],
      );
      if (r.rows[0]) return r.rows[0];
    }
    const r = await this.db.query(
      "INSERT INTO roomwise.users(id,email,name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,name",
      [randomUUID(), email, name, passwordHash],
    );
    return r.rows[0];
  }
  async mergeGuest(owner: string, guestId: string | null) {
    if (!guestId || owner === guestId) return;
    const locked = await this.db.query(
      "SELECT id,email,subscription_id,stripe_customer_id,pro_active,billing_event_at FROM roomwise.users WHERE id IN ($1,$2) ORDER BY id FOR UPDATE",
      [owner, guestId],
    );
    const guest = locked.rows.find((r) => r.id === guestId),
      target = locked.rows.find((r) => r.id === owner);
    if (!guest || guest.email || !target) return;
    await this.db.query(
      "UPDATE roomwise.projects SET user_id=$1 WHERE user_id=$2",
      [owner, guestId],
    );
    if (!target.subscription_id && guest.subscription_id) {
      await this.db.query(
        "UPDATE roomwise.users SET subscription_id=NULL,stripe_customer_id=NULL,pro_active=false WHERE id=$1",
        [guestId],
      );
      await this.db.query(
        "UPDATE roomwise.users SET subscription_id=$1,pro_active=$2,billing_event_at=$3,stripe_customer_id=COALESCE(stripe_customer_id,$4) WHERE id=$5",
        [
          guest.subscription_id,
          guest.pro_active,
          guest.billing_event_at,
          guest.stripe_customer_id,
          owner,
        ],
      );
    }
    await this.db.query("DELETE FROM roomwise.sessions WHERE user_id=$1", [
      guestId,
    ]);
  }
  async resetPassword(tokenHash: string, passwordHash: string) {
    const r = await this.db.query(
      "DELETE FROM roomwise.password_resets WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
      [tokenHash],
    );
    if (!r.rows[0]) return false;
    const id = r.rows[0].user_id;
    await this.db.query(
      "UPDATE roomwise.users SET password_hash=$1,email_verified=true WHERE id=$2",
      [passwordHash, id],
    );
    await this.db.query("DELETE FROM roomwise.sessions WHERE user_id=$1", [id]);
    await this.db.query(
      "DELETE FROM roomwise.password_resets WHERE user_id=$1",
      [id],
    );
    await this.db.query(
      "DELETE FROM roomwise.magic_links WHERE email=(SELECT email FROM roomwise.users WHERE id=$1)",
      [id],
    );
    return true;
  }
}
