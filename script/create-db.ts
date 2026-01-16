import { Client } from "pg";

async function main() {
  const adminUrl = process.env.ADMIN_DATABASE_URL;

  if (!adminUrl) {
    throw new Error("ADMIN_DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: adminUrl });

  try {
    await client.connect();
    await client.query('CREATE DATABASE "Trae Godnotes"');
    console.log('Database "Trae Godnotes" created (or already exists).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

