type Props = {
    text: string;
    classname?: string;
    bordered?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    onClick?: () => void
}
export const Button = ({text, classname, bordered, size = 'md', onClick}: Props) => {
    const sizeClasses = {
        xs: 'py-2 px-4',
        sm: 'py-3 px-5',
        md: 'py-3.5 px-6',
        lg: 'py-4 px-8',
    };
    return ( 
        <button onClick={onClick} className={`rounded-full ${sizeClasses[size]} text-sm font-bold
        ${bordered? 'border border-gray-300 text-black bg-transparent active:bg-black active:text-white duration-100' : 'bg-black text-white active:bg-black/70 duration-100'}
        ${classname}`}>
            {text}
        </button>
    );
}