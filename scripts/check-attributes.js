import { Client, Databases } from 'node-appwrite';

const PROJECT_ID = '696f3047000b49d7776e';
const API_ENDPOINT = 'https://cloud.appwrite.io/v1';
const SECRET_KEY = 'standard_976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697';
const DATABASE_ID = 'godnotes-db';

const client = new Client()
    .setEndpoint(API_ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(SECRET_KEY);

const databases = new Databases(client);

async function checkAttributes() {
    try {
        console.log('--- Checking Attributes ---');
        
        try {
            const notes = await databases.listAttributes(DATABASE_ID, 'notes');
            console.log('\n[Notes Collection Attributes]:');
            notes.attributes.forEach(attr => {
                console.log(`- ${attr.key} (${attr.type}) required=${attr.required}`);
            });
        } catch (e) {
            console.error('Error fetching notes attributes:', e.message);
        }

        try {
            const folders = await databases.listAttributes(DATABASE_ID, 'folders');
            console.log('\n[Folders Collection Attributes]:');
            folders.attributes.forEach(attr => {
                console.log(`- ${attr.key} (${attr.type}) required=${attr.required}`);
            });
        } catch (e) {
            console.error('Error fetching folders attributes:', e.message);
        }

    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkAttributes();
