import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0],
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0],
});

const [rows] = await connection.execute(
  'SELECT id, email, name, subscriptionTier, subscriptionStatus FROM users WHERE email LIKE ?',
  ['%filipepcm%']
);

console.log('Usuários encontrados:');
rows.forEach(row => {
  console.log(`ID: ${row.id}, Email: ${row.email}, Nome: ${row.name}, Tier: ${row.subscriptionTier}, Status: ${row.subscriptionStatus}`);
});

connection.end();
