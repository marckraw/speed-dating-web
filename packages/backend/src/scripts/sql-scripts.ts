import "dotenv/config";
import { pool } from "../db";

async function run() {
  // await pool.query(`ALTER TABLE habits ADD COLUMN type TEXT DEFAULT 'boolean'`); - some example sql script
  console.log("✅ Column added successfully");
  await pool.end();
}

run().catch(console.error);
