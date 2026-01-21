import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const ADMIN_ACCOUNTS = [
  { 
    email: "tiagosennachacon@gmail.com", 
    password: "*Chacon120304", 
    name: "Tiago Senna Chacon",
    role: "admin"
  },
  { 
    email: "zealtecnologia@gmail.com", 
    password: "*entusiasmocomDeus", 
    name: "Zeal Tecnologia",
    role: "admin"
  },
  { 
    email: "victorodriguez2611@gmail.com", 
    password: "Lutivito26", 
    name: "Victor Rodriguez",
    role: "admin"
  }
];

async function seedAdmins() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(databaseUrl);
  
  console.log('Connected to database');
  console.log('Creating admin accounts...\n');

  for (const admin of ADMIN_ACCOUNTS) {
    try {
      // Generate password hash
      const passwordHash = await bcrypt.hash(admin.password, 10);
      
      // Generate unique openId for email-based auth
      const openId = `email_${crypto.createHash('sha256').update(admin.email.toLowerCase()).digest('hex').substring(0, 32)}`;
      
      // Check if user already exists
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE email = ? OR openId = ?',
        [admin.email, openId]
      );
      
      if (existing.length > 0) {
        // Update existing user
        await connection.execute(
          `UPDATE users SET 
            passwordHash = ?,
            name = ?,
            role = ?,
            subscriptionStatus = 'active',
            loginMethod = 'email',
            updatedAt = NOW()
          WHERE email = ? OR openId = ?`,
          [passwordHash, admin.name, admin.role, admin.email, openId]
        );
        console.log(`✅ Updated: ${admin.email} (admin with unlimited access)`);
      } else {
        // Insert new user
        await connection.execute(
          `INSERT INTO users (openId, passwordHash, name, email, loginMethod, role, subscriptionStatus, createdAt, updatedAt, lastSignedIn, consultationCount, consultationCountResetAt)
           VALUES (?, ?, ?, ?, 'email', 'admin', 'active', NOW(), NOW(), NOW(), 0, NOW())`,
          [openId, passwordHash, admin.name, admin.email]
        );
        console.log(`✅ Created: ${admin.email} (admin with unlimited access)`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${admin.email}:`, error.message);
    }
  }

  await connection.end();
  console.log('\n✅ Admin seeding completed!');
}

seedAdmins().catch(console.error);
