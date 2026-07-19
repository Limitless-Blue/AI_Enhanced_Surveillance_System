import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

interface BaseProps {
  label?: string
  hint?: string
  required?: boolean
  className?: string
}

const baseInputCls =
  'w-full bg-mx-bg-elev/80 border border-mx-border text-mx-green-50 text-sm rounded-md px-3 py-2 font-mono placeholder:text-mx-text-mute placeholder:font-mono focus:outline-none focus:border-mx-green-400 focus:bg-mx-green-900/20 transition-colors'

const labelCls =
  'block font-mono text-[10px] uppercase tracking-[0.25em] text-mx-text-dim mb-1.5'

export function MxLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className={labelCls}>
      <span className="opacity-50">{'>'}</span> {children}{' '}
      {required && <span className="text-mx-green-400">*</span>}
    </label>
  )
}

interface MxInputProps extends InputHTMLAttributes<HTMLInputElement>, BaseProps {}
export function MxInput({ label, hint, required, className = '', ...rest }: MxInputProps) {
  return (
    <div className={className}>
      {label && <MxLabel required={required}>{label}</MxLabel>}
      <input {...rest} required={required} className={baseInputCls} />
      {hint && <p className="font-mono text-[10px] text-mx-text-mute mt-1">// {hint}</p>}
    </div>
  )
}

interface MxTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseProps {}
export function MxTextarea({ label, hint, required, className = '', ...rest }: MxTextareaProps) {
  return (
    <div className={className}>
      {label && <MxLabel required={required}>{label}</MxLabel>}
      <textarea {...rest} required={required} className={baseInputCls} />
      {hint && <p className="font-mono text-[10px] text-mx-text-mute mt-1">// {hint}</p>}
    </div>
  )
}

interface MxSelectProps extends SelectHTMLAttributes<HTMLSelectElement>, BaseProps {
  children: ReactNode
}
export function MxSelect({ label, hint, required, className = '', children, ...rest }: MxSelectProps) {
  return (
    <div className={className}>
      {label && <MxLabel required={required}>{label}</MxLabel>}
      <select {...rest} required={required} className={baseInputCls}>
        {children}
      </select>
      {hint && <p className="font-mono text-[10px] text-mx-text-mute mt-1">// {hint}</p>}
    </div>
  )
}

export const MxFileInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & BaseProps>(
  function MxFileInput({ label, hint, required, className = '', ...rest }, ref) {
    return (
      <div className={className}>
        {label && <MxLabel required={required}>{label}</MxLabel>}
        <input
          ref={ref}
          type="file"
          {...rest}
          required={required}
          className="block w-full text-xs text-mx-text-dim font-mono
            file:mr-3 file:rounded-md file:border file:border-mx-green-400/60
            file:bg-mx-green-900/40 file:text-mx-green-100 file:text-[10px]
            file:uppercase file:tracking-widest file:font-mono
            file:px-3 file:py-1.5 file:cursor-pointer
            hover:file:bg-mx-green-800/50 hover:file:border-mx-green-400"
        />
        {hint && <p className="font-mono text-[10px] text-mx-text-mute mt-1">// {hint}</p>}
      </div>
    )
  },
)
