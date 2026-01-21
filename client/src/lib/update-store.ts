import { create } from 'zustand';

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateStore {
  progress: UpdateProgress | null;
  setProgress: (progress: UpdateProgress | null) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
}));
