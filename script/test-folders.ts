async function main() {
  const baseUrl = "http://localhost:5000";
  const email = `foldertest_${Date.now()}@example.com`;
  const password = "password123";
  const name = "Folder Tester";

  console.log("Registering user", email);

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: email,
      password,
      name,
    }),
  });

  if (!registerRes.ok) {
    const text = await registerRes.text();
    throw new Error(
      `Register failed: ${registerRes.status} ${registerRes.statusText} ${text}`,
    );
  }

  const cookie = registerRes.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("No session cookie returned from register");
  }

  console.log("Checking /api/auth/me");

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      cookie,
    },
  });

  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(
      `Auth me failed: ${meRes.status} ${meRes.statusText} ${text}`,
    );
  }

  const me = await meRes.json();
  console.log("Me:", me);

  const createBody = {
    name: "Test Folder",
    parentId: null as string | null,
  };

  console.log("Creating folder");

  const createRes = await fetch(`${baseUrl}/api/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(
      `Create folder failed: ${createRes.status} ${createRes.statusText} ${text}`,
    );
  }

  const created = await createRes.json();
  console.log("Created folder:", created);

  const folderId: string = created.id;

  console.log("Listing folders");

  const listRes = await fetch(`${baseUrl}/api/folders`, {
    headers: {
      cookie,
    },
  });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(
      `List folders failed: ${listRes.status} ${listRes.statusText} ${text}`,
    );
  }

  const list = (await listRes.json()) as unknown[];
  console.log("Folders list:", list);

  const found = Array.isArray(list)
    ? list.find((f: any) => f.id === folderId)
    : undefined;

  if (!found) {
    throw new Error("Created folder not found in list");
  }

  console.log("Updating folder");

  const updateRes = await fetch(`${baseUrl}/api/folders/${folderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      name: "Updated Folder",
      parentId: null,
    }),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(
      `Update folder failed: ${updateRes.status} ${updateRes.statusText} ${text}`,
    );
  }

  const updated = await updateRes.json();
  console.log("Updated folder:", updated);

  if (updated.name !== "Updated Folder") {
    throw new Error("Folder name was not updated");
  }

  console.log("Deleting folder");

  const deleteRes = await fetch(`${baseUrl}/api/folders/${folderId}`, {
    method: "DELETE",
    headers: {
      cookie,
    },
  });

  if (!deleteRes.ok && deleteRes.status !== 204) {
    const text = await deleteRes.text();
    throw new Error(
      `Delete folder failed: ${deleteRes.status} ${deleteRes.statusText} ${text}`,
    );
  }

  const listAfterRes = await fetch(`${baseUrl}/api/folders`, {
    headers: {
      cookie,
    },
  });

  if (!listAfterRes.ok) {
    const text = await listAfterRes.text();
    throw new Error(
      `List after delete failed: ${listAfterRes.status} ${listAfterRes.statusText} ${text}`,
    );
  }

  const listAfter = (await listAfterRes.json()) as unknown[];
  console.log("Folders after delete:", listAfter);

  const stillExists = Array.isArray(listAfter)
    ? listAfter.find((f: any) => f.id === folderId)
    : undefined;

  if (stillExists) {
    throw new Error("Folder was not deleted");
  }

  console.log("All folder routes work correctly");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

