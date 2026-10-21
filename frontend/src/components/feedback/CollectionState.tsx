import { Skeleton } from '@/components/ui/skeleton';

export function CollectionLoading({ label = 'Loading records' }: { label?: string }) {
  return <div role="status" className="space-y-5 p-5"><span className="sr-only">{label}</span>{[1, 2, 3].map((key) => <div key={key} className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-2/3" /></div>)}</div>;
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="space-y-2 px-5 py-12 text-center"><h2 className="text-sm font-medium">{title}</h2><p className="mx-auto max-w-md text-[13px] leading-6 text-content-secondary">{description}</p></div>;
}
