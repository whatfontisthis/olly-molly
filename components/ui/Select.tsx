'use client';

interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
}

export function Select({ label, value, onChange, options, placeholder, className = '' }: SelectProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    {label}
                </label>
            )}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`
          w-full px-4 py-2.5 rounded-lg border bg-[var(--bg-tertiary)] text-[var(--text-primary)]
          transition-all duration-200 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          border-[var(--border-primary)] hover:border-[var(--border-secondary)]
          ${className}
        `}
            >
                {placeholder && (
                    <option value="" disabled className="text-[var(--text-muted)]">
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[var(--bg-secondary)]">
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
