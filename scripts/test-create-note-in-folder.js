import { Client, Databases, ID, Permission, Role, Query } from 'node-appwrite';

const PROJECT_ID = '696f3047000b49d7776e';
const API_ENDPOINT = 'https://cloud.appwrite.io/v1';
const SECRET_KEY = 'standard_976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697';
const DATABASE_ID = 'godnotes-db';

const client = new Client()
    .setEndpoint(API_ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(SECRET_KEY);

const databases = new Databases(client);

async function testCreateNoteInFolder() {
    try {
        console.log('--- Testing Create Note In Folder ---');

        // 1. Get a user ID (we need a valid user ID for permissions)
        // For this test we'll use a hardcoded user ID if we can't find one, 
        // or just list documents to find an existing user ID.
        // Let's assume we can use the first folder's owner.
        const folders = await databases.listDocuments(DATABASE_ID, 'folders', [Query.limit(1)]);
        if (folders.documents.length === 0) {
            console.log('No folders found to get a user ID from. Cannot proceed securely without a user context.');
            // Fallback: Create a dummy user ID? No, permissions require real users usually or role:all.
            // But we are using server key, so we can impersonate or just set any user ID.
            // Let's use a dummy ID for the test document, but permissions might fail if that user doesn't exist?
            // Actually server key bypasses permissions.
        }
        
        const userId = folders.documents[0]?.userId || 'test-user-id';
        console.log('Using UserId:', userId);

        // 2. Create a test folder
        console.log('Creating test folder...');
        const folder = await databases.createDocument(
            DATABASE_ID,
            'folders',
            ID.unique(),
            {
                name: 'Test Folder ' + Date.now(),
                userId: userId,
                parentId: null,
                isFavorite: false,
                tags: []
            }
        );
        console.log('Folder created:', folder.$id);

        // 3. Create a note inside that folder
        console.log('Creating note inside folder...');
        const note = await databases.createDocument(
            DATABASE_ID,
            'notes',
            ID.unique(),
            {
                title: 'Test Note inside ' + folder.name,
                content: 'Some content',
                folderId: folder.$id, // THIS IS KEY
                userId: userId,
                isFavorite: false,
                tags: []
            }
        );
        console.log('Note created:', JSON.stringify(note, null, 2));

        if (note.folderId === folder.$id) {
            console.log('SUCCESS: Note is correctly linked to folder.');
        } else {
            console.error('FAILURE: Note folderId mismatch!', note.folderId, 'expected', folder.$id);
        }

        // Cleanup
        console.log('Cleaning up...');
        await databases.deleteDocument(DATABASE_ID, 'notes', note.$id);
        await databases.deleteDocument(DATABASE_ID, 'folders', folder.$id);
        console.log('Cleanup done.');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testCreateNoteInFolder();
