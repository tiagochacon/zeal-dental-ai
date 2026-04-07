import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0],
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0],
});

try {
  console.log('🔄 Corrigindo priceId para PRO...\n');

  // O priceId correto do PRO é: price_1SuYhvJBQOFbtGZhu5hcAhqH
  const [result] = await connection.execute(
    `UPDATE users SET 
      subscriptionTier = 'pro',
      subscriptionStatus = 'active',
      priceId = 'price_1SuYhvJBQOFbtGZhu5hcAhqH',
      consultationCount = 0,
      consultationCountResetAt = NOW(),
      trialEndsAt = NULL
    WHERE email = ?`,
    ['filipepcm89@gmail.com']
  );

  console.log(`✅ Atualizado ${result.affectedRows} usuário(s)`);

  // Verify
  const [rows] = await connection.execute(
    'SELECT id, email, name, subscriptionTier, subscriptionStatus, priceId, consultationCount FROM users WHERE email = ?',
    ['filipepcm89@gmail.com']
  );

  if (rows.length > 0) {
    const user = rows[0];
    console.log('\n📊 Status final:');
    console.log(`Email: ${user.email}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Tier: ${user.subscriptionTier}`);
    console.log(`Status: ${user.subscriptionStatus}`);
    console.log(`Price ID: ${user.priceId}`);
    console.log(`Consultas: ${user.consultationCount}`);
  }

} catch (error) {
  console.error('❌ Erro:', error.message);
} finally {
  connection.end();
}
