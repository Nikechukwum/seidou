type Props = {
    color: string;
}
export const SmallLoader = ({color}: Props) => {
    return ( 
        <div 
        className={`animate-spin rounded-full size-4 border-2 border-b-transparent border-l-transparent mx-auto ${color}`} 
        />
    );
}