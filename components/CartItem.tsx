import useCart from "@/hooks/useCart";
import { ItemType } from "@/redux/cartSlice";
import { formatCurrency } from "@/utils/helpers";
import { Trash2 } from "lucide-react";
import { motion, PanInfo } from "motion/react";
import Image from "next/image";
import { useState } from "react";

type Props = {
    item: ItemType
}
export const CartItem = ({item}: Props) => {
    const { addToCart, removeFromCart, decreaseQuantity, isLoading } = useCart()
    const [deleteTrigger, setDeleteTrigger] = useState(false)

    const handleDragEnd = (info: PanInfo) => {
        if(Math.abs(info.offset.x ) >= 220){
            setDeleteTrigger(true)
            setTimeout(() => {
                removeFromCart(item.id)
            }, 1000);
        }
    }

    return ( 
        <motion.div layout className="space-y-4">
            <div className="relative w-full h-fit shrink-0 overflow-hidden">
                <motion.div drag='x' dragConstraints={{left: 0, right: 0}} dragElastic={{right: 0, left: 1}} animate={{x: deleteTrigger? '-100%': 0, transition:{duration: 0.3}}}
                onDragEnd={(e, info)=>{handleDragEnd(info)}}
                className="flex bg-white relative z-1">
                    {/* Image container */}
                    <div className="relative h-36 w-28 shrink-0">
                        <Image
                            className="object-cover rounded-lg"
                            fill
                            src={item.image}
                            alt="Product Image"
                            sizes="(max-width: 768px) 100px, 120px"
                            quality={65}
                        />
                    </div>

                    <div className="flex flex-col grow pl-4 pr-6 py-1">
                        <span className="line-clamp-3">{item.title}</span>
                        <span className="font-bold">{formatCurrency(item.price)}</span>
                    </div>

                    <div className="absolute right-2 bottom-2 flex w-fit cursor-pointer justify-evenly items-center text-xl text-gray-300">
                        <button disabled={isLoading} onClick={() => {decreaseQuantity(item.id)}} className="px-1.5"> - </button>
                        <div className="bg-gray-100 w-8 h-8 rounded-md text-base flex items-center justify-center text-black font-bold">
                            {isLoading? 
                                <div className="animate-spin rounded-full h-4.5 w-4.5 border-2 border-b-transparent border-l-transparent border-black/90 my-1 mx-auto" />
                                :
                                item.quantity
                            }
                        </div>
                        <button disabled={isLoading} onClick={() => {addToCart(item)}} className="px-1.5"> + </button>
                    </div>
                </motion.div>
                {/* Red deletion background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-white -translate-y-1/2 z-0 flex justify-between items-center text-lg px-5 bg-rose-500 h-[calc(100%-3px)] w-[calc(100%-3px)]">
                    <span>Removing...</span> <Trash2 size={30} className="text-white "/>
                </div>
            </div>
            <hr className="border-[#e8e8e8]"/>
        </motion.div>
    );
}