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