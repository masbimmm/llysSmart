const { createClient } = require('@libsql/client');

async function migrate() {
  const client = createClient({ url: 'file:local.db' });
  console.log('Connecting to local.db...');

  // 1. Add unlocked_bodies
  try {
    await client.execute('ALTER TABLE users ADD COLUMN unlocked_bodies TEXT;');
    console.log('✓ Added column: unlocked_bodies');
  } catch (err) {
    console.log('unlocked_bodies status:', err.message);
  }

  // 2. Add equipped_body
  try {
    await client.execute('ALTER TABLE users ADD COLUMN equipped_body TEXT;');
    console.log('✓ Added column: equipped_body');
  } catch (err) {
    console.log('equipped_body status:', err.message);
  }

  // 3. Create system_settings table
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );`);
    console.log('✓ Created/verified system_settings table');
  } catch (err) {
    console.log('system_settings status:', err.message);
  }

  // 4. Verify columns in users table
  const info = await client.execute('PRAGMA table_info(users)');
  console.log('Verified users columns:');
  console.log(info.rows.map(r => r.name));

  // 5. Verify system_settings table
  const settingsInfo = await client.execute('PRAGMA table_info(system_settings)');
  console.log('Verified system_settings columns:');
  console.log(settingsInfo.rows.map(r => r.name));
}

migrate().then(() => {
  console.log('Migration finished successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
