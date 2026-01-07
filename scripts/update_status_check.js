const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'db', 'dev.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('Migrating tickets table to include NEED_FIX status...');

try {
  db.transaction(() => {
    // 1. Create new table with updated CHECK constraint
    db.prepare(`
      CREATE TABLE tickets_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'TODO' CHECK(status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'NEED_FIX', 'COMPLETE', 'ON_HOLD')),
        priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        assignee_id TEXT REFERENCES members(id),
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Copy data from old table to new table
    db.prepare(`
      INSERT INTO tickets_new (id, title, description, status, priority, assignee_id, created_by, created_at, updated_at)
      SELECT id, title, description, status, priority, assignee_id, created_by, created_at, updated_at FROM tickets
    `).run();

    // 3. Drop old table
    db.prepare('DROP TABLE tickets').run();

    // 4. Rename new table to tickets
    db.prepare('ALTER TABLE tickets_new RENAME TO tickets').run();

    // 5. Recreate indexes
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id)').run();
  })();

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
