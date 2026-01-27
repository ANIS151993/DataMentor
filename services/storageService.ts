
import { Project, DatasetMetadata, User } from '../types';

const DB_NAME = 'DataMentorDB';
const STORE_PROJECTS = 'projects';
const STORE_DATASETS = 'datasets';
const STORE_USERS = 'users';

class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_DATASETS)) db.createObjectStore(STORE_DATASETS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_USERS)) db.createObjectStore(STORE_USERS, { keyPath: 'email' });
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUser(user: User, passwordHash: string): Promise<void> {
    const tx = this.db!.transaction(STORE_USERS, 'readwrite');
    tx.objectStore(STORE_USERS).put({ ...user, passwordHash });
    return new Promise((r) => tx.oncomplete = () => r());
  }

  async getUser(email: string): Promise<any> {
    const tx = this.db!.transaction(STORE_USERS, 'readonly');
    const request = tx.objectStore(STORE_USERS).get(email);
    return new Promise((r) => request.onsuccess = () => r(request.result));
  }

  async saveDataset(id: string, file: File): Promise<void> {
    const tx = this.db!.transaction(STORE_DATASETS, 'readwrite');
    tx.objectStore(STORE_DATASETS).put({ id, data: file, name: file.name, size: file.size, lastModified: Date.now() });
    return new Promise((r) => tx.oncomplete = () => r());
  }

  async getDataset(id: string): Promise<{ data: Blob, name: string } | null> {
    const tx = this.db!.transaction(STORE_DATASETS, 'readonly');
    const request = tx.objectStore(STORE_DATASETS).get(id);
    return new Promise((r) => request.onsuccess = () => r(request.result));
  }

  async saveProject(project: Project): Promise<void> {
    const tx = this.db!.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(project);
    return new Promise((r) => tx.oncomplete = () => r());
  }

  async getProjects(): Promise<Project[]> {
    const tx = this.db!.transaction(STORE_PROJECTS, 'readonly');
    const request = tx.objectStore(STORE_PROJECTS).getAll();
    return new Promise((r) => request.onsuccess = () => r(request.result));
  }

  async getProject(id: string): Promise<Project | null> {
    const tx = this.db!.transaction(STORE_PROJECTS, 'readonly');
    const request = tx.objectStore(STORE_PROJECTS).get(id);
    return new Promise((r) => request.onsuccess = () => r(request.result));
  }

  async deleteProject(id: string): Promise<void> {
    const tx = this.db!.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(id);
    return new Promise((r) => tx.oncomplete = () => r());
  }
}

export const storage = new StorageService();
