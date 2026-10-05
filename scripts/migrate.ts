import { database } from "../lib/database";
async function main() {
  const db = await database();
  if (!db)
    throw new Error("Set DATABASE_URL to a PostgreSQL connection string.");
  await db.query("SELECT 1");
  console.log("Roomwise PostgreSQL schema is ready.");
  await db.end();
}
main().catch(() => {
  console.error(
    "Migration failed. Check database configuration and connectivity.",
  );
  process.exitCode = 1;
});
