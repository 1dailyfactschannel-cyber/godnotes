import { Client, Databases, ID } from 'node-appwrite';

const PROJECT_ID = '696f3047000b49d7776e';
const API_ENDPOINT = 'https://cloud.appwrite.io/v1';
const SECRET_KEY = 'standard_976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697';
const DATABASE_ID = 'godnotes-db';

const client = new Client()
    .setEndpoint(API_ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(SECRET_KEY);

const databases = new Databases(client);

async function reproduce() {
    try {
        console.log('Fetching a folder to test with...');
        const folders = await databases.listDocuments(DATABASE_ID, 'folders');
        
        if (folders.documents.length === 0) {
            console.log('No folders found. Creating one...');
            console.error('No folders found to test inside.');
            return;
        }

        const folder = folders.documents[0];
        console.log(`Using folder: ${folder.name} (${folder.$id})`);
        console.log(`Folder owner: ${folder.userId}`);

        console.log('Attempting to create a note inside this folder...');
        
        const note = await databases.createDocument(
            DATABASE_ID,
            'notes',
            ID.unique(),
            {
                title: 'Test Note in Folder ' + new Date().toISOString(),
                content: 'This is a test note.',
                folderId: folder.$id,
                userId: folder.userId,
                tags: [],
                isFavorite: false
            }
        );

        console.log('Note created successfully!');
        console.log('Note ID:', note.$id);
        console.log('Note Folder ID:', note.folderId);

        if (note.folderId !== folder.$id) {
            console.error('MISMATCH! Note folderId is different from requested folderId.');
        } else {
            console.log('SUCCESS: Note is correctly inside the folder.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

reproduce();