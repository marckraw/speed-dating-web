import "dotenv/config";

async function run() {
  // await pool.query(`ALTER TABLE habits ADD COLUMN type TEXT DEFAULT 'boolean'`); - some example sql script
  console.log("✅ Column added successfully");
}

run().catch(console.error);
