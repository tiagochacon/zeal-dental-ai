import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0],
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0],
});

const [rows] = await connection.execute(
  'SELECT id, email, name, subscriptionTier, subscriptionStatus, consultationCount, trialEndsAt FROM users WHERE email = ?',
  ['filipepcm89@gmail.com']
);

console.log('Status atual da conta:');
console.log(JSON.stringify(rows[0], null, 2));

connection.end();
