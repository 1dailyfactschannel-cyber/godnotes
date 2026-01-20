import { Client, Databases, ID, Permission, Role, Storage } from 'node-appwrite';

const PROJECT_ID = '696f3047000b49d7776e';
const API_ENDPOINT = 'https://cloud.appwrite.io/v1';
const SECRET_KEY = 'standard_976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697';
const DATABASE_ID = 'godnotes-db';
const BUCKET_ID = 'godnotes-storage';

const client = new Client()
    .setEndpoint(API_ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(SECRET_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

async function setup() {
    try {
        console.log('Checking database...');
        try {
            await databases.get(DATABASE_ID);
            console.log('Database already exists.');
        } catch (e) {
            console.log('Creating database...');
            await databases.create(DATABASE_ID, 'GodNotes Database');
        }

        // Folders Collection
        console.log('Checking folders collection...');
        try {
            await databases.getCollection(DATABASE_ID, 'folders');
            console.log('Folders collection already exists.');
            
            // Update permissions
            console.log('Updating folders permissions...');
            await databases.updateCollection(
                DATABASE_ID, 
                'folders', 
                'Folders', 
                [Permission.create(Role.users())], 
                true // documentSecurity = true
            );

            // Check and create attributes if missing
            console.log('Checking folder attributes...');
            const { attributes } = await databases.listAttributes(DATABASE_ID, 'folders');
            const attributeNames = attributes.map(a => a.key);

            if (!attributeNames.includes('name')) await databases.createStringAttribute(DATABASE_ID, 'folders', 'name', 255, true);
            if (!attributeNames.includes('parentId')) await databases.createStringAttribute(DATABASE_ID, 'folders', 'parentId', 255, false);
            if (!attributeNames.includes('userId')) await databases.createStringAttribute(DATABASE_ID, 'folders', 'userId', 255, true);
            if (!attributeNames.includes('tags')) await databases.createStringAttribute(DATABASE_ID, 'folders', 'tags', 255, false, undefined, true);
            if (!attributeNames.includes('isFavorite')) await databases.createBooleanAttribute(DATABASE_ID, 'folders', 'isFavorite', false, false);

        } catch (e) {
            console.log('Creating folders collection...');
            await databases.createCollection(
                DATABASE_ID, 
                'folders', 
                'Folders',
                [Permission.create(Role.users())],
                true
            );
            
            console.log('Creating folder attributes...');
            await databases.createStringAttribute(DATABASE_ID, 'folders', 'name', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'folders', 'parentId', 255, false); // nullable
            await databases.createStringAttribute(DATABASE_ID, 'folders', 'userId', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'folders', 'tags', 255, false, undefined, true); // array
            await databases.createBooleanAttribute(DATABASE_ID, 'folders', 'isFavorite', false, false);
        }

        // Notes Collection
        console.log('Checking notes collection...');
        try {
            await databases.getCollection(DATABASE_ID, 'notes');
            console.log('Notes collection already exists.');

            // Update permissions
            console.log('Updating notes permissions...');
            await databases.updateCollection(
                DATABASE_ID, 
                'notes', 
                'Notes', 
                [Permission.create(Role.users())], 
                true // documentSecurity = true
            );
            
            // Check and create attributes if missing
            console.log('Checking note attributes...');
            const { attributes } = await databases.listAttributes(DATABASE_ID, 'notes');
            const attributeNames = attributes.map(a => a.key);
            
            if (!attributeNames.includes('title')) await databases.createStringAttribute(DATABASE_ID, 'notes', 'title', 255, true);
            if (!attributeNames.includes('content')) await databases.createStringAttribute(DATABASE_ID, 'notes', 'content', 1000000, false);
            if (!attributeNames.includes('folderId')) await databases.createStringAttribute(DATABASE_ID, 'notes', 'folderId', 255, false);
            if (!attributeNames.includes('userId')) await databases.createStringAttribute(DATABASE_ID, 'notes', 'userId', 255, true);
            if (!attributeNames.includes('tags')) await databases.createStringAttribute(DATABASE_ID, 'notes', 'tags', 255, false, undefined, true);
            if (!attributeNames.includes('isFavorite')) await databases.createBooleanAttribute(DATABASE_ID, 'notes', 'isFavorite', false, false);

        } catch (e) {
            console.log('Creating notes collection...');
            await databases.createCollection(
                DATABASE_ID, 
                'notes', 
                'Notes',
                [Permission.create(Role.users())],
                true
            );
            
            console.log('Creating note attributes...');
            await databases.createStringAttribute(DATABASE_ID, 'notes', 'title', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'notes', 'content', 1000000, false); // Large text
            await databases.createStringAttribute(DATABASE_ID, 'notes', 'folderId', 255, false); // nullable
            await databases.createStringAttribute(DATABASE_ID, 'notes', 'userId', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'notes', 'tags', 255, false, undefined, true); // array
            await databases.createBooleanAttribute(DATABASE_ID, 'notes', 'isFavorite', false, false);
        }

        // Storage Bucket
        console.log('Checking storage bucket...');
        try {
            await storage.getBucket(BUCKET_ID);
            console.log('Storage bucket already exists.');
            
            // Update permissions
            console.log('Updating bucket permissions...');
            await storage.updateBucket(
                BUCKET_ID, 
                'GodNotes Storage', 
                [
                    Permission.read(Role.users()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users())
                ],
                false, // fileSecurity
                true, // enabled
                undefined, // maxFileSize
                undefined, // allowedFileExtensions
                'gzip', // compression
                true, // encryption
                true // antivirus
            );

        } catch (e) {
            console.log('Creating storage bucket...');
            await storage.createBucket(
                BUCKET_ID, 
                'GodNotes Storage', 
                [
                    Permission.read(Role.users()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users())
                ],
                false, // fileSecurity
                true, // enabled
                undefined, // maxFileSize
                undefined, // allowedFileExtensions
                'gzip', // compression
                true, // encryption
                true // antivirus
            );
        }

        console.log('Setup complete!');
    } catch (error) {
        console.error('Setup failed:', error);
    }
}

setup();
