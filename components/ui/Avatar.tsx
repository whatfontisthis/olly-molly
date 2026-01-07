'use client';

interface AvatarProps {
    src?: string | null;
    name: string;
    size?: 'sm' | 'md' | 'lg';
    emoji?: string | null;
}

export function Avatar({ src, name, size = 'md', emoji }: AvatarProps) {
    const sizes = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-12 h-12 text-lg',
    };

    // Get initials from name
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Generate consistent color based on name
    const colors = [
        'from-violet-500 to-purple-600',
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;

    if (emoji) {
        return (
            <div className={`
        ${sizes[size]} rounded-full flex items-center justify-center
        bg-gradient-to-br ${colors[colorIndex]}
      `}>
                <span className={size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-base'}>
                    {emoji}
                </span>
            </div>
        );
    }

    if (src) {
        return (
            <img
                src={src}
                alt={name}
                className={`${sizes[size]} rounded-full object-cover`}
            />
        );
    }

    return (
        <div className={`
      ${sizes[size]} rounded-full flex items-center justify-center font-medium text-white
      bg-gradient-to-br ${colors[colorIndex]}
    `}>
            {initials}
        </div>
    );
}
