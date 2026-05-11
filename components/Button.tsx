type Props = {
    text: string;
    classname?: string;
    bordered?: boolean;
    onClick?: () => void
}
export const Button = ({text, classname, bordered, onClick}: Props) => {
    return ( 
        <button onClick={onClick} className={`rounded-full py-3.5 px-6 text-sm font-bold
        ${bordered? 'border border-gray-300 text-black bg-transparent active:bg-black active:text-white duration-100' : 'bg-black text-white active:bg-black/70 duration-100'}
        ${classname}`}>
            {text}
        </button>
    );
}