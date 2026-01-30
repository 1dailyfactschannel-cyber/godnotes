import { useFileSystem, compareItems, type FileSystemItem } from '@/lib/data-store';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'temp-id-123') }));

jest.mock('@/lib/electron', () => ({
  isElectron: () => false,
  getDocumentsPath: jest.fn(),
  selectDirectory: jest.fn(),
  getStoreValue: jest.fn(),
  setStoreValue: jest.fn(),
  fs: null,
}));

jest.mock('@/lib/auth-service', () => ({
  authService: {
    login: jest.fn(async (email: string, password: string) => ({
      user: {
        id: 'u1',
        email,
        name: 'User',
        username: 'user',
        avatar_url: null,
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      token: 'jwt-abc',
    })),
    register: jest.fn(async (email: string, password: string, name: string) => ({
      user: {
        id: 'u2',
        email,
        name,
        username: 'user2',
        avatar_url: null,
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      token: 'jwt-def',
    })),
    logout: jest.fn(async () => {}),
  },
}));

describe('compareItems', () => {
  it('returns true when only content differs', () => {
    const a: FileSystemItem[] = [
      {
        id: '1',
        name: 'A',
        type: 'file',
        parentId: null,
        content: 'x',
        createdAt: 1,
        isPinned: false,
        isFavorite: false,
        tags: ['t'],
        backlinks: [],
        isProtected: false,
        isPublic: false,
        isPending: false,
      },
    ];
    const b: FileSystemItem[] = [{ ...a[0], content: 'y' }];
    expect(compareItems(a, b)).toBe(true);
  });

  it('returns false when metadata differs', () => {
    const a: FileSystemItem[] = [
      { id: '1', name: 'A', type: 'file', parentId: null, createdAt: 1 } as any,
    ];
    const b: FileSystemItem[] = [{ ...a[0], name: 'B' }];
    expect(compareItems(a, b)).toBe(false);
  });

  it('returns false when tags differ', () => {
    const a: FileSystemItem[] = [
      { id: '1', name: 'A', type: 'file', parentId: null, createdAt: 1, tags: ['a'] } as any,
    ];
    const b: FileSystemItem[] = [{ ...a[0], tags: ['b'] }];
    expect(compareItems(a, b)).toBe(false);
  });

  it('returns false when length differs', () => {
    const a: FileSystemItem[] = [
      { id: '1', name: 'A', type: 'file', parentId: null, createdAt: 1 } as any,
    ];
    const b: FileSystemItem[] = [];
    expect(compareItems(a, b)).toBe(false);
  });
});

describe('addFile', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    useFileSystem.setState({
      items: [],
      activeFileId: null,
      user: null,
      isAuthenticated: false,
      localDocumentsPath: null,
      expandedFolders: new Set(),
      lastCreatedFileId: null,
    });
    fetchMock = jest.fn();
    // @ts-ignore
    global.fetch = fetchMock;
  });

  it('creates local file when unauthenticated', async () => {
    const store = useFileSystem.getState();
    await store.addFile(null, 'Test Note', 'Hello');
    const { items, activeFileId, lastCreatedFileId } = useFileSystem.getState();
    const created = items.find(i => i.name === 'Test Note' && i.type === 'file');
    expect(created).toBeDefined();
    expect(created?.content).toBe('Hello');
    expect(created?.parentId).toBeNull();
    expect(activeFileId).toBe(created!.id);
    expect(lastCreatedFileId).toBe(created!.id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs to server and replaces temp id when authenticated', async () => {
    useFileSystem.setState({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email: 'x@y.z',
        name: 'U',
        username: 'u',
        avatar_url: null,
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
        prefs: {},
      } as any,
    });
    const nowIso = new Date().toISOString();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'server-id-001',
        title: 'Test Note',
        content: 'Hello',
        folderId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        isFavorite: false,
        tags: [],
      }),
    } as Response);
    await useFileSystem.getState().addFile(null, 'Test Note', 'Hello');
    const { items, activeFileId, lastCreatedFileId } = useFileSystem.getState();
    expect(items.some(i => i.id === 'temp-id-123')).toBe(false);
    const created = items.find(i => i.id === 'server-id-001');
    expect(created).toBeDefined();
    expect(activeFileId).toBe('server-id-001');
    expect(lastCreatedFileId).toBe('server-id-001');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch('/notes');
    expect((opts as any).method).toBe('POST');
  });
});

describe('searchGlobal', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    useFileSystem.setState({
      items: [],
      isOfflineMode: false,
    });
    fetchMock = jest.fn();
    // @ts-ignore
    global.fetch = fetchMock;
  });

  it('returns local results only in offline mode', async () => {
    useFileSystem.setState({
      isOfflineMode: true,
      items: [
        { id: 'a1', name: 'Hello Note', type: 'file', parentId: null, content: 'hello world', createdAt: Date.now() },
        { id: 'a2', name: 'Other', type: 'file', parentId: null, content: 'unrelated', createdAt: Date.now(), tags: ['deleted:2024-01-01'] },
        { id: 'a3', name: 'HELLO NAME', type: 'file', parentId: null, content: 'something', createdAt: Date.now() },
      ] as any,
    });
    const res = await useFileSystem.getState().searchGlobal('hello');
    const ids = res.map(i => i.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('a3');
    expect(ids).not.toContain('a2');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('merges server and local results, filtering duplicates by id', async () => {
    useFileSystem.setState({
      isOfflineMode: false,
      items: [
        { id: 'local1', name: 'Local', type: 'file', parentId: null, content: 'hello from local', createdAt: Date.now() },
        { id: 'local2', name: 'Another', type: 'file', parentId: null, content: 'hello again', createdAt: Date.now() },
      ] as any,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([
        { id: 'server1', title: 'Server Note', content: 'hello content', folderId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [] },
        { id: 'local1', title: 'Local on server', content: 'hello EXTRA', folderId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [] },
      ]),
    } as Response);
    const res = await useFileSystem.getState().searchGlobal('hello');
    const ids = res.map(i => i.id).sort();
    expect(ids).toEqual(['server1', 'local1', 'local2'].sort());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns [] when query is empty', async () => {
    const res = await useFileSystem.getState().searchGlobal('');
    expect(res).toEqual([]);
  });
});

describe('updateFileContent 404 id migration', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    localStorage.clear();
    useFileSystem.setState({
      items: [
        { id: 'old-id-123', name: 'Note A', type: 'file', parentId: null, content: 'A', createdAt: Date.now(), updatedAt: Date.now() } as any,
      ],
      activeFileId: 'old-id-123',
      openFiles: ['old-id-123'],
      user: {
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        username: 'user',
        avatar_url: null,
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
        prefs: {},
      } as any,
      isAuthenticated: true,
      isOfflineMode: false,
      offlineQueue: [
        {
          id: 'q1',
          method: 'PATCH',
          endpoint: '/notes/old-id-123',
          payload: { content: 'B' },
          itemId: 'old-id-123',
          timestamp: Date.now(),
          attempts: 0,
        } as any,
      ],
    });
    fetchMock = jest.fn();
    // @ts-ignore
    global.fetch = fetchMock;
  });

  it('creates note on 404 and replaces local id across state and offline queue', async () => {
    const nowIso = new Date().toISOString();

    // First: PATCH returns 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not Found' }),
    } as Response);

    // Second: POST returns created note
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'new-id-456',
        title: 'Note A',
        content: 'B',
        folderId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        isFavorite: false,
        tags: [],
      }),
    } as Response);

    const store = useFileSystem.getState();
    store.updateFileContent('old-id-123', 'B');

    // Run debounce timer
    jest.advanceTimersByTime(1000);
    // Flush microtasks
    await Promise.resolve();

    const state = useFileSystem.getState();

    // New item exists and content updated
    expect(state.items.some(i => i.id === 'new-id-456')).toBe(true);
    const newItem = state.items.find(i => i.id === 'new-id-456')!;
    expect(newItem.content).toBe('B');

    // Active/open references migrated
    expect(state.activeFileId).toBe('new-id-456');
    expect(state.openFiles.includes('new-id-456')).toBe(true);
    expect(state.openFiles.includes('old-id-123')).toBe(false);

    // Last saved id updated
    expect(state.lastSavedFileId).toBe('new-id-456');

    // Offline queue endpoints rewritten
    const q = state.offlineQueue;
    expect(q.length).toBeGreaterThan(0);
    expect(q.every(op => op.endpoint !== '/notes/old-id-123')).toBe(true);
    expect(q.some(op => op.endpoint === '/notes/new-id-456' && op.itemId === 'new-id-456')).toBe(true);

    // Calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchOpts] = fetchMock.mock.calls[0];
    expect(String(patchUrl)).toMatch('/notes/old-id-123');
    expect((patchOpts as any).method).toBe('PATCH');
    const [postUrl, postOpts] = fetchMock.mock.calls[1];
    expect(String(postUrl)).toMatch('/notes');
    expect((postOpts as any).method).toBe('POST');
  });
});

describe('auth flows preserve local items', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    useFileSystem.setState({
      items: [
        { id: 'local1', name: 'Local Note', type: 'file', parentId: null, content: 'L', createdAt: Date.now() } as any,
      ],
      isAuthenticated: false,
      isOfflineMode: false,
      user: null,
    });
    fetchMock = jest.fn();
    // @ts-ignore
    global.fetch = fetchMock;
  });

  it('preserves local items and merges server items on login', async () => {
    // Pre-populate localStorage keys that should be cleared
    localStorage.setItem('localItems', '[]');
    localStorage.setItem('activeFileId', 'x');
    localStorage.setItem('openFiles', '[]');
    localStorage.setItem('expandedFolders', '[]');
    localStorage.setItem('aiConfig', '{}');
    localStorage.setItem('securityConfig', '{}');
    localStorage.setItem('user', '{}');
    localStorage.setItem('auth_token', 'oldtoken');

    // Mock folders then notes
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 'fold1', name: 'Server Folder', parentId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [] },
        ]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 'server1', title: 'Server Note', content: 'S', folderId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [], isPublic: false },
        ]),
      } as Response);

    await useFileSystem.getState().login('user@example.com', 'pw');

    const state = useFileSystem.getState();
    const ids = state.items.map(i => i.id).sort();
    expect(ids).toEqual(['local1', 'server1', 'fold1'].sort());

    // localStorage keys should be cleared by clearUserData
    expect(localStorage.getItem('localItems')).toBeNull();
    expect(localStorage.getItem('activeFileId')).toBeNull();
    expect(localStorage.getItem('openFiles')).toBeNull();
    expect(localStorage.getItem('expandedFolders')).toBeNull();
    expect(localStorage.getItem('aiConfig')).toBeNull();
    expect(localStorage.getItem('securityConfig')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves local items and merges server items on register', async () => {
    // Pre-populate some localStorage keys that should be cleared
    localStorage.setItem('localItems', '[]');
    localStorage.setItem('auth_token', 'oldtoken');

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 'foldX', name: 'Srv Folder', parentId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [] },
        ]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 'srvX', title: 'Srv Note', content: 'X', folderId: null, createdAt: new Date().toISOString(), isFavorite: false, tags: [], isPublic: false },
        ]),
      } as Response);

    await useFileSystem.getState().register('new@example.com', 'pw', 'New User');

    const state = useFileSystem.getState();
    const ids = state.items.map(i => i.id).sort();
    expect(ids).toEqual(['local1', 'srvX', 'foldX'].sort());

    // localStorage keys cleared
    expect(localStorage.getItem('localItems')).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});