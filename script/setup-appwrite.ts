import { Client, Databases, Permission, Role, ID } from 'node-appwrite';

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '696f3047000b49d7776e';
const API_KEY = '976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697';
const DATABASE_ID = 'godnotes-db';

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function setup() {
    console.log('Starting Appwrite setup...');

    // 1. Create Database
    try {
        await databases.get(DATABASE_ID);
        console.log(`Database "${DATABASE_ID}" already exists.`);
    } catch (error) {
        console.log(`Creating database "${DATABASE_ID}"...`);
        await databases.create(DATABASE_ID, 'GodNotes Database');
        console.log(`Database "${DATABASE_ID}" created.`);
    }

    // 2. Create 'folders' collection
    try {
        await databases.getCollection(DATABASE_ID, 'folders');
        console.log('Collection "folders" already exists.');
    } catch (error) {
        console.log('Creating collection "folders"...');
        await databases.createCollection(DATABASE_ID, 'folders', 'Folders', [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
            Permission.read(Role.any()), // Allow read for now, refine later
        ]);
        console.log('Collection "folders" created.');

        // Attributes for 'folders'
        console.log('Creating attributes for "folders"...');
        await databases.createStringAttribute(DATABASE_ID, 'folders', 'name', 255, true);
        await databases.createStringAttribute(DATABASE_ID, 'folders', 'parentId', 255, false); // Nullable
        await databases.createBooleanAttribute(DATABASE_ID, 'folders', 'isFavorite', false, false);
        await databases.createStringAttribute(DATABASE_ID, 'folders', 'tags', 255, false, undefined, true); // Array
        await databases.createStringAttribute(DATABASE_ID, 'folders', 'userId', 255, true);
        console.log('Attributes for "folders" created.');
    }

    // 3. Create 'notes' collection
    try {
        await databases.getCollection(DATABASE_ID, 'notes');
        console.log('Collection "notes" already exists.');
    } catch (error) {
        console.log('Creating collection "notes"...');
        await databases.createCollection(DATABASE_ID, 'notes', 'Notes', [
            Permission.read(Role.users()),
            Permission.write(Role.users()),
             Permission.read(Role.any()),
        ]);
        console.log('Collection "notes" created.');

        // Attributes for 'notes'
        console.log('Creating attributes for "notes"...');
        await databases.createStringAttribute(DATABASE_ID, 'notes', 'title', 255, true);
        await databases.createStringAttribute(DATABASE_ID, 'notes', 'content', 1000000, false); // Large text
        await databases.createStringAttribute(DATABASE_ID, 'notes', 'folderId', 255, false); // Nullable
        await databases.createBooleanAttribute(DATABASE_ID, 'notes', 'isFavorite', false, false);
        await databases.createStringAttribute(DATABASE_ID, 'notes', 'tags', 255, false, undefined, true); // Array
        await databases.createStringAttribute(DATABASE_ID, 'notes', 'userId', 255, true);
        console.log('Attributes for "notes" created.');
    }
    
    // Wait for attributes to be processed
    console.log('Setup completed! Attributes might take a few seconds to become available.');
}

setup().catch(console.error);
