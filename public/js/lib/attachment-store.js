/**
 * AttachmentStore — IndexedDB blob storage for Notes & Calendar (T-049)
 * Shared utility for drag-and-drop file attachments.
 */

const DB_NAME = 'nexus-attachments';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';
const MAX_FILE_BYTES = 5 * 1024 * 1024;   // 5 MB per file
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB total

let _db = null;

function _openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function _sha256(arrayBuffer) {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: random id
    return 'rnd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
}

async function _totalSize() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = async () => {
      let total = 0;
      for (const key of keysReq.result) {
        try {
          const blob = await _getRaw(key);
          total += blob?.size || 0;
        } catch {/* skip */}
      }
      resolve(total);
    };
    keysReq.onerror = () => reject(keysReq.error);
  });
}

async function _getRaw(key) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Build a blob URL from stored data. Caller must revoke when done.
async function _buildBlobUrl(key, mime) {
  const blob = await _getRaw(key);
  if (!blob) return null;
  const actualBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mime || 'application/octet-stream' });
  return URL.createObjectURL(actualBlob);
}

export const AttachmentStore = {
  async isAvailable() {
    try { await _openDB(); return true; } catch { return false; }
  },

  /** Max single file size in bytes */
  maxFileBytes() { return MAX_FILE_BYTES; },

  /**
   * Save a file and return metadata.
   * @param {File} file
   * @param {string} itemId - e.g. note id or event id
   * @returns {Promise<{ok:boolean, meta?:object, error?:string}>}
   */
  async saveFile(file, itemId) {
    if (!window.indexedDB) return { ok: false, error: 'File storage unavailable in this browser' };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` };

    const db = await _openDB();
    const buffer = await file.arrayBuffer();
    const hash = await _sha256(buffer);
    const key = `attachments/${itemId}/${hash}`;

    // Check existing global usage
    try {
      const total = await _totalSize();
      if (total >= MAX_TOTAL_BYTES) return { ok: false, error: 'Storage quota exceeded (50 MB total)' };
    } catch { /* allow through if we can't measure */ }

    // Dedupe: if same hash already exists under any key, reuse
    const existing = await _getRaw(`dedup/${hash}`);
    if (existing) {
      // Ensure the item-specific key also exists (hardlink style)
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(existing, key);
      return {
        ok: true,
        meta: {
          id: 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          name: file.name,
          size: file.size,
          type: file.type,
          hash,
          key,
          createdAt: Date.now()
        }
      };
    }

    const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      store.put(blob, `dedup/${hash}`);
      tx.oncomplete = () => {
        resolve({
          ok: true,
          meta: {
            id: 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            size: file.size,
            type: file.type,
            hash,
            key,
            createdAt: Date.now()
          }
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Delete a single attachment blob and its dedup reference if orphaned.
   * @param {object} meta - attachment metadata object
   */
  async deleteFile(meta) {
    if (!meta || !meta.key) return;
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(meta.key);
      if (meta.hash) store.delete(`dedup/${meta.hash}`);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Get an object URL for viewing/downloading an attachment.
   * Caller must call URL.revokeObjectURL(url) when done.
   * @param {object} meta
   */
  async getUrl(meta) {
    if (!meta || !meta.key) return null;
    return _buildBlobUrl(meta.key, meta.type);
  },

  /**
   * Download a file to disk.
   * @param {object} meta
   */
  async download(meta) {
    const url = await this.getUrl(meta);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  /**
   * Get a thumbnail data URL for an image attachment.
   * @param {object} meta
   * @param {number} maxWidth
   * @returns {Promise<string|null>} data URL
   */
  async thumbnail(meta, maxWidth = 200) {
    if (!meta || !meta.type?.startsWith('image/')) return null;
    const url = await this.getUrl(meta);
    if (!url) return null;
    try {
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      return dataUrl;
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  },

  /**
   * Scan for orphaned blobs (not referenced by any item metadata).
   * @param {string[]} usedKeys - flat array of all keys currently referenced
   */
  async orphanScan(usedKeys) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      keysReq.onsuccess = () => {
        const set = new Set(usedKeys);
        let removed = 0;
        for (const key of keysReq.result) {
          if (key.startsWith('dedup/')) continue; // ignore dedup layer during scan
          if (!set.has(key)) {
            store.delete(key);
            removed++;
          }
        }
        resolve(removed);
      };
      keysReq.onerror = () => reject(keysReq.error);
    });
  }
};

// Convenience helpers for Notes/Calendar
export function attachStrip(container, attachments = [], opts = {}) {
  const { onDelete, onDownload } = opts;
  container.innerHTML = '';
  if (!attachments || !attachments.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  attachments.forEach(att => {
    const wrap = document.createElement('div');
    wrap.className = 'attachment-chip';
    wrap.title = att.name || 'File';
    if (att.type?.startsWith('image/')) {
      const thumb = document.createElement('img');
      thumb.className = 'attachment-thumb';
      thumb.alt = att.name || '';
      thumb.loading = 'lazy';
      // Lazy-load thumbnail
      AttachmentStore.thumbnail(att, 80).then(url => { if (url) thumb.src = url; });
      wrap.appendChild(thumb);
    } else {
      const icon = document.createElement('div');
      icon.className = 'attachment-icon';
      icon.textContent = '📄';
      wrap.appendChild(icon);
    }
    const name = document.createElement('span');
    name.className = 'attachment-name';
    name.textContent = att.name || 'File';
    wrap.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'attachment-actions';

    const dl = document.createElement('button');
    dl.className = 'attachment-action';
    dl.title = 'Download';
    dl.innerHTML = '⬇️';
    dl.addEventListener('click', (e) => { e.stopPropagation(); if (onDownload) onDownload(att); else AttachmentStore.download(att); });
    actions.appendChild(dl);

    const del = document.createElement('button');
    del.className = 'attachment-action';
    del.title = 'Remove';
    del.innerHTML = '✕';
    del.addEventListener('click', (e) => { e.stopPropagation(); if (onDelete) onDelete(att); });
    actions.appendChild(del);

    wrap.appendChild(actions);
    container.appendChild(wrap);
  });
}

/** Returns allowed MIME types string for <input accept> */
export function supportedMimeTypes() {
  return 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown';
}

/**
 * Wire drag-and-drop + file input to a container.
 * @param {HTMLElement} zone - element to receive drops
 * @param {object} opts
 * @param {Function} opts.onFiles - callback(files) when files are selected/dropped
 * @param {HTMLElement} [opts.input] - hidden file input to trigger
 */
export function wireAttachmentDrop(zone, opts = {}) {
  const { onFiles, input } = opts;
  if (!zone) return;

  const acceptDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('attachment-dragover');
  };
  const leaveDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('attachment-dragover');
  };
  const dropDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('attachment-dragover');
    const files = e.dataTransfer?.files;
    if (files?.length && onFiles) onFiles(Array.from(files));
  };

  zone.addEventListener('dragenter', acceptDrag);
  zone.addEventListener('dragover', acceptDrag);
  zone.addEventListener('dragleave', leaveDrag);
  zone.addEventListener('drop', dropDrag);

  if (input) {
    input.addEventListener('change', () => {
      if (input.files?.length && onFiles) onFiles(Array.from(input.files));
      input.value = '';
    });
  }
}
