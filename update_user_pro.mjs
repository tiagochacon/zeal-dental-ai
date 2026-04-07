import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0],
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0],
});

try {
  // Update user to PRO tier
  const [result] = await connection.execute(
    `UPDATE users SET 
      subscriptionTier = 'pro',
      subscriptionStatus = 'active',
      priceId = 'price_1SuYhvJBQOFbtGZhu5hcAhqH',
      consultationCount = 0,
      consultationCountResetAt = NOW()
    WHERE email = ?`,
    ['filipepcm89@gmail.com']
  );

  console.log(`✅ Updated ${result.affectedRows} user(s) to PRO tier`);

  // Verify the update
  const [rows] = await connection.execute(
    'SELECT id, email, subscriptionTier, subscriptionStatus, consultationCount FROM users WHERE email = ?',
    ['filipepcm89@gmail.com']
  );

  console.log('\n📊 Updated user:');
  console.log(JSON.stringify(rows[0], null, 2));

} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  connection.end();
}
