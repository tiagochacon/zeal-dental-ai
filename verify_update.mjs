import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0],
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0],
});

const [rows] = await connection.execute(
  'SELECT id, email, name, subscriptionTier, subscriptionStatus, consultationCount, priceId FROM users WHERE email = ?',
  ['filipepcm89@gmail.com']
);

if (rows.length > 0) {
  console.log('✅ Conta atualizada com sucesso:\n');
  const user = rows[0];
  console.log(`Email: ${user.email}`);
  console.log(`Nome: ${user.name}`);
  console.log(`Tier: ${user.subscriptionTier}`);
  console.log(`Status: ${user.subscriptionStatus}`);
  console.log(`Consultas usadas: ${user.consultationCount}`);
  console.log(`Price ID: ${user.priceId}`);
} else {
  console.log('❌ Usuário não encontrado');
}

connection.end();
