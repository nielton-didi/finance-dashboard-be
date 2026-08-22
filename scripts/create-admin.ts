// One-off bootstrap script — creates the first admin user.
// Deliberately NOT a migration: a checked-in migration with a real (even if "temporary")
// password is a leaked credential the moment it's committed. Run this once per environment instead:
//
//   ADMIN_EMAIL=you@example.com ADMIN_FULL_NAME="Your Name" ADMIN_PASSWORD='...' \
//     npx ts-node -r tsconfig-paths/register scripts/create-admin.ts
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/app-db.data-source';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const fullName = process.env.ADMIN_FULL_NAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !fullName || !password) {
    console.error(
      'ADMIN_EMAIL, ADMIN_FULL_NAME, and ADMIN_PASSWORD env vars are all required',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    const existing = await AppDataSource.query(
      `SELECT [id] FROM [dbo].[users] WHERE [email] = @0`,
      [email],
    );
    if (existing.length > 0) {
      console.log(`User ${email} already exists — nothing to do.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await AppDataSource.query(
      `INSERT INTO [dbo].[users] ([full_name], [email], [password_hash], [role], [status])
       VALUES (@0, @1, @2, 'admin', 'active')`,
      [fullName, email, passwordHash],
    );
    console.log(`Created admin user ${email}.`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
