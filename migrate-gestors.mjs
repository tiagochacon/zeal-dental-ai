/**
 * Migration script: Promote all users with active subscription or trial
 * to gestor role and create clinics for them.
 * 
 * This fixes the retroactive issue where ensureUserIsGestor was added
 * to the code but not run for existing users.
 */
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Find all users that should be gestor but aren't
  // Criteria: has subscriptionStatus active/trialing OR has trialStartedAt
  // AND clinicRole is NOT 'gestor'
  // AND clinicRole is NOT 'crc' or 'dentista' (these are team members, not owners)
  const [usersToFix] = await conn.execute(`
    SELECT id, name, email, role, clinicRole, clinicId, subscriptionStatus, subscriptionTier
    FROM users 
    WHERE (clinicRole IS NULL OR clinicRole = '')
    AND (
      subscriptionStatus IN ('active', 'trialing')
      OR trialStartedAt IS NOT NULL
    )
    ORDER BY id
  `);
  
  console.log(`Found ${usersToFix.length} users to promote to gestor:\n`);
  
  for (const user of usersToFix) {
    console.log(`Processing user ${user.id} (${user.name} - ${user.email})...`);
    
    // Check if user already has a clinic as owner
    const [existingClinics] = await conn.execute(
      'SELECT id, name FROM clinics WHERE ownerId = ?',
      [user.id]
    );
    
    let clinicId;
    if (existingClinics.length > 0) {
      clinicId = existingClinics[0].id;
      console.log(`  → Already owns clinic ${clinicId} (${existingClinics[0].name})`);
    } else {
      // Create a new clinic
      const clinicName = user.name ? `Clínica de ${user.name}` : 'Clínica';
      const [result] = await conn.execute(
        'INSERT INTO clinics (name, ownerId) VALUES (?, ?)',
        [clinicName, user.id]
      );
      clinicId = result.insertId;
      console.log(`  → Created clinic ${clinicId} (${clinicName})`);
    }
    
    // Update user to gestor with clinicId
    await conn.execute(
      'UPDATE users SET clinicRole = ?, clinicId = ? WHERE id = ?',
      ['gestor', clinicId, user.id]
    );
    console.log(`  → Set clinicRole='gestor', clinicId=${clinicId}`);
    console.log(`  ✅ Done\n`);
  }
  
  console.log(`\nMigration complete. ${usersToFix.length} users promoted to gestor.`);
  
  // Verify
  const [verification] = await conn.execute(`
    SELECT id, name, email, clinicRole, clinicId 
    FROM users 
    WHERE clinicRole = 'gestor' 
    ORDER BY id
  `);
  console.log('\nAll gestors after migration:');
  console.table(verification);
  
  await conn.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
