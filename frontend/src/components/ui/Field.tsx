import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Input } from './input';

const control = 'block w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 disabled:opacity-50';
export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const generatedId = useId(); const id = props.id || generatedId;
  return <div className="space-y-2"><label htmlFor={id} className="block text-[13px] font-medium">{label}</label><Input {...props} id={id} aria-describedby={hint ? `${id}-hint` : props['aria-describedby']} />{hint && <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>;
}
export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId(); return <div className="space-y-2"><label htmlFor={id} className="block text-[13px] font-medium">{label}</label><select {...props} id={id} className={control}>{children}</select></div>;
}
export function TextField({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId(); return <div className="space-y-2"><label htmlFor={id} className="block text-[13px] font-medium">{label}</label><textarea {...props} id={id} className={`${control} min-h-24 resize-y`} /></div>;
}
export function CheckField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId(); return <label htmlFor={id} className="flex min-h-10 items-start gap-3 py-2 text-[13px] leading-5"><input {...props} id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" /><span>{label}</span></label>;
}
