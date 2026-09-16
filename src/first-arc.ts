import 'dotenv/config';
import { db } from '../prisma/db';

const email = `demo-${Date.now()}@example.com`;
const created = await db.orm.public.User.create({
  email,
  username: 'demo-user',
  name: 'Demo User',
  password: 'demo-password',
});