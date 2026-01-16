import { storage } from "../server/storage";

async function main() {
  const username = `test_user_${Date.now()}`;
  const password = "test_password";

  const created = await storage.createUser({ username, password });
  console.log("created", created);

  const fetched = await storage.getUserByUsername(username);
  console.log("fetched", fetched);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

