import { Client, Account, Databases, Storage } from 'appwrite';

export const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('696f3047000b49d7776e');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const DATABASE_ID = 'godnotes-db';
export const BUCKET_ID = 'godnotes-storage';
export const COLLECTIONS = {
    FOLDERS: 'folders',
    NOTES: 'notes'
};
