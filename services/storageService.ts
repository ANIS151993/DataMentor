
import { Project, User } from '../types';
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'datasets';
const DB_NAME = 'DataMentorDB';
const STORE_NAME = 'files';

interface StoredFile {
    blob: Blob;
    name: string;
}

export interface CloudFile {
    name: string;
    path: string;
    size: number;
    lastModified: string;
}

export interface DatasetRecoveryResult {
    data: Blob;
    name: string;
    isLocal: boolean;
    recoveredDatasetId?: string;
}

class StorageService {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 12); 
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => { this.db = request.result; resolve(request.result); };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveLocalFile(id: string, blob: Blob, name: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ blob, name }, id);
  }

  private async getLocalFile(id: string): Promise<StoredFile | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async listAllUserFiles(): Promise<CloudFile[]> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    
    const userId = auth.user.id;
    const { data: folders, error: foldersError } = await supabase.storage.from(BUCKET_NAME).list(userId, { limit: 100 });
    
    if (foldersError || !folders) return [];

    let allFiles: CloudFile[] = [];
    for (const folder of folders) {
        if (folder.id === null) { // It's a directory
            const { data: files } = await supabase.storage.from(BUCKET_NAME).list(`${userId}/${folder.name}`);
            if (files) {
                files.filter(f => !f.name.startsWith('.')).forEach(f => {
                    allFiles.push({
                        name: f.name,
                        path: `${userId}/${folder.name}/${f.name}`,
                        size: f.metadata?.size || 0,
                        lastModified: f.created_at || new Date().toISOString()
                    });
                });
            }
        }
    }
    return allFiles;
  }

  async deleteStorageFile(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) throw error;
  }

  async saveDataset(datasetId: string, file: File | Blob, fileName: string): Promise<{ path: string; isLocal: boolean }> {
    const safeName = this.sanitize(fileName);
    await this.saveLocalFile(datasetId, file as Blob, safeName);
    
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { path: datasetId, isLocal: true };

    const userId = auth.user.id;
    const folderPath = `${userId}/${datasetId}`;
    const filePath = `${folderPath}/${safeName}`;
    
    try {
        const { data: existing } = await supabase.storage.from(BUCKET_NAME).list(folderPath);
        if (existing && existing.length > 0) {
            await supabase.storage.from(BUCKET_NAME).remove(existing.map(f => `${folderPath}/${f.name}`));
        }
        const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, { 
            upsert: true,
            contentType: file instanceof File ? file.type : (safeName.endsWith('.csv') ? 'text/csv' : 'application/octet-stream')
        });
        if (uploadError) throw uploadError;
        return { path: filePath, isLocal: false };
    } catch (e) {
        return { path: datasetId, isLocal: true };
    }
  }

  async getDataset(datasetId: string, projectId?: string, hintName?: string): Promise<DatasetRecoveryResult | null> {
    const local = await this.getLocalFile(datasetId);
    if (local) return { data: local.blob, name: local.name, isLocal: false };

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const userId = auth.user.id;

    const searchPaths = [`${userId}/${datasetId}`];
    if (projectId && projectId !== datasetId) searchPaths.push(`${userId}/${projectId}`);

    for (const path of searchPaths) {
        const { data: files } = await supabase.storage.from(BUCKET_NAME).list(path);
        if (files && files.length > 0) {
            const file = files.find(f => !f.name.startsWith('.')) || files[0];
            const fullPath = `${path}/${file.name}`;
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(fullPath);
            if (data && !error) {
                await this.saveLocalFile(datasetId, data, file.name);
                return { data, name: file.name, isLocal: false };
            }
        }
    }

    const safeHint = hintName ? this.sanitize(hintName) : null;
    const { data: folders } = await supabase.storage.from(BUCKET_NAME).list(userId, { limit: 1000 });
    
    if (folders) {
        for (const folder of folders) {
            const { data: subfiles } = await supabase.storage.from(BUCKET_NAME).list(`${userId}/${folder.name}`);
            if (subfiles) {
                const match = subfiles.find(f => {
                    const sanitizedName = this.sanitize(f.name);
                    return (
                        (hintName && (f.name === hintName || f.name.includes(hintName))) ||
                        (safeHint && (sanitizedName === safeHint || sanitizedName.includes(safeHint))) ||
                        f.name.includes(datasetId)
                    );
                });
                if (match) {
                    const fullPath = `${userId}/${folder.name}/${match.name}`;
                    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(fullPath);
                    if (data && !error) {
                        await this.saveLocalFile(datasetId, data, match.name);
                        return { data, name: match.name, isLocal: false, recoveredDatasetId: folder.name };
                    }
                }
            }
        }
    }
    return null;
  }

  async saveProject(project: Project): Promise<void> {
    const local = JSON.parse(localStorage.getItem('dm_projects') || '[]');
    const idx = local.findIndex((p: any) => p.id === project.id);
    if (idx > -1) local[idx] = project; else local.push(project);
    localStorage.setItem('dm_projects', JSON.stringify(local));

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
        await supabase.from('projects').upsert({
            id: project.id,
            user_id: auth.user.id,
            name: project.name,
            dataset_id: project.datasetId,
            cells: project.cells,
            created_at: new Date(project.createdAt).toISOString()
        });
    }
  }

  async getProjects(): Promise<Project[]> {
    const local = JSON.parse(localStorage.getItem('dm_projects') || '[]');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return local;

    try {
        const { data: cloud } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (!cloud) return local;
        const merged: Project[] = [...local];
        cloud.forEach(cp => {
            const idx = merged.findIndex(lp => lp.id === cp.id);
            const p: Project = { id: cp.id, name: cp.name, datasetId: cp.dataset_id || cp.id, cells: cp.cells || [], createdAt: new Date(cp.created_at).getTime() };
            if (idx > -1) { if (p.cells.length >= merged[idx].cells.length) merged[idx] = p; }
            else { merged.push(p); }
        });
        return merged.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        return local;
    }
  }

  async deleteProject(id: string, datasetId?: string): Promise<void> {
    const local = JSON.parse(localStorage.getItem('dm_projects') || '[]');
    localStorage.setItem('dm_projects', JSON.stringify(local.filter((p: any) => p.id !== id)));

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        if (datasetId) store.delete(datasetId);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
        await supabase.from('projects').delete().eq('id', id);
        const uniqueFolders = Array.from(new Set([datasetId, id].filter(Boolean)));
        for (const folderName of uniqueFolders) {
            const folderPath = `${auth.user.id}/${folderName}`;
            const { data: files } = await supabase.storage.from(BUCKET_NAME).list(folderPath);
            if (files?.length) {
                await supabase.storage.from(BUCKET_NAME).remove(files.map(file => `${folderPath}/${file.name}`));
            }
        }
    }
  }
}

export const storage = new StorageService();
