import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ComposerDraft {
  text: string;
  editing: { id: string; text: string } | null;
  action: 'send' | 'approve' | 'reject' | null;
  error: string | null;
  notice: string | null;
}
const emptyDraft: ComposerDraft = {
  text: '',
  editing: null,
  action: null,
  error: null,
  notice: null,
};
interface ComposerContextValue {
  drafts: Record<string, ComposerDraft>;
  update: (
    id: string,
    patch: Partial<ComposerDraft> | ((draft: ComposerDraft) => Partial<ComposerDraft>),
  ) => void;
  start: (id: string, action: NonNullable<ComposerDraft['action']>) => boolean;
  finish: (id: string, patch?: Partial<ComposerDraft>) => void;
}
const ComposerContext = createContext<ComposerContextValue | null>(null);

/** Lives in the authenticated dashboard: drafts survive view changes, never logout. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>({});
  const locks = useRef(new Set<string>());
  const update = useCallback<ComposerContextValue['update']>((id, patch) => {
    setDrafts((previous) => {
      const draft = previous[id] ?? emptyDraft;
      return {
        ...previous,
        [id]: { ...draft, ...(typeof patch === 'function' ? patch(draft) : patch) },
      };
    });
  }, []);
  const start = useCallback<ComposerContextValue['start']>(
    (id, action) => {
      if (locks.current.has(id)) return false;
      locks.current.add(id);
      update(id, { action, error: null, notice: null });
      return true;
    },
    [update],
  );
  const finish = useCallback<ComposerContextValue['finish']>(
    (id, patch = {}) => {
      locks.current.delete(id);
      update(id, { ...patch, action: null });
    },
    [update],
  );
  const value = useMemo(() => ({ drafts, update, start, finish }), [drafts, update, start, finish]);
  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposerDraft(id: string) {
  const context = useContext(ComposerContext);
  if (!context) throw new Error('ComposerProvider is required');
  return {
    draft: context.drafts[id] ?? emptyDraft,
    update: context.update,
    start: context.start,
    finish: context.finish,
  };
}
