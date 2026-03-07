'use client'
import { DecreaseQuantity, IncreaseQuantity, RemoveFromCart, ToggleCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { sanityClient, urlFor } from "@/sanity/lib/client";
import { formatCurrency } from "@/utils/helpers";
import { ChevronDown, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, PanInfo } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";


export const Cart = ({}) => {
    const router = useRouter()
    const selfRef = useRef<HTMLDivElement>(null)
    const [dragTarget, setDragTarget] = useState('')
    const [deleteTrigger, setDeleteTrigger] = useState(false)
    const dispatch = useDispatch()
    const {isOpen, products} = useSelector(
        (state: RootState) => state.cart
    );

    const totalPrice = () => {
        let total = 0
        products.forEach((item)=>{
            total += (item.price * item.quantity)
        })

        return total
    }

    const handleDragEnd = (info: PanInfo) => {
        if(Math.abs(info.offset.x ) >= 220){
            setDeleteTrigger(true)
            setTimeout(() => {
                dispatch(RemoveFromCart(dragTarget))
                setDragTarget('')
                setDeleteTrigger(false)
            }, 1000);
        }
    }

    return ( 
        <AnimatePresence>
            {isOpen && 
                <section ref={selfRef} className="fixed max-w-md -translate-x-1/2 -translate-y-1/2 z-12 left-1/2 top-1/2 h-dvh w-full overscroll-none overflow-hidden">
                    <motion.div initial={{y: '10%', opacity: 0}} animate={{y: 0, opacity: 1, transition:{duration: 0.3}}} exit={{y: '10%', opacity: 0, transition:{duration: 0.3}}}
                    onClick={(e)=>{e.stopPropagation()}} className="h-dvh w-full bg-white relative flex-col flex justify-between">
                        <div className="relative shrink-0 h-16 w-full grid place-content-center font-semibold text-2xl border-b-2 border-b-[#f0f0f0]">
                            <button onClick={()=>{dispatch(ToggleCart(false))}} className="absolute text-black top-1/2 left-5 -translate-y-1/2 p-2">
                                <X strokeWidth={2} /> 
                            </button>
                            Bag
                        </div>
                        <div className="grow p-3 overflow-y-scroll space-y-4 pb-10">
                            {products.map((item)=>{
                                return(
                                    <motion.div key={item.id} layout className="space-y-4">
                                        <div className="relative w-full h-fit shrink-0 overflow-hidden">
                                            <motion.div drag='x' dragConstraints={{left: 0, right: 0}} dragElastic={{right: 0, left: 0.7}} animate={{x: dragTarget===item.id && deleteTrigger? '-100%': 0, transition:{duration: 0.3}}}
                                            onDragStart={()=>{setDragTarget(item.id)}}
                                            onDragEnd={(e, info)=>{handleDragEnd(info)}}
                                            className="flex bg-white relative z-1">
                                                <div className="relative h-36 w-28">
                                                    <Image
                                                        className="object-cover rounded-lg"
                                                        fill
                                                        src={item.image}
                                                        alt="Product Image"
                                                        sizes="(max-width: 768px) 100px, 120px"
                                                        quality={65}
                                                    />
                                                </div>

                                                <div className="flex flex-col px-4 py-1">
                                                    <span>{item.title}</span>
                                                    <span className="font-bold">{formatCurrency(item.price)}</span>
                                                </div>

                                                <div className="absolute right-2 bottom-2 flex w-20 cursor-pointer justify-evenly text-xl text-gray-300">
                                                    <div onClick={() => {dispatch(DecreaseQuantity(item.id))}}> - </div>
                                                    <div className="bg-gray-100  px-3 text-base flex items-center text-black">
                                                        {item.quantity}
                                                    </div>
                                                    <div onClick={() => {dispatch(IncreaseQuantity(item.id))}}> + </div>
                                                </div>
                                            </motion.div>
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-white -translate-y-1/2 z-0 flex justify-between items-center text-lg px-5 bg-red-400 h-[calc(100%-3px)] w-[calc(100%-3px)]">
                                                <span>Removing...</span> <Trash2 size={30} className="text-white "/>
                                            </div>
                                        </div>
                                        <hr className="border-[#e8e8e8]"/>
                                    </motion.div>
                                )
                            })}
                        </div>
                        <div className="h-fit shrink-0 py-5 px-3 w-full">
                            <div className="mb-5 flex justify-between items-center text-[#7a7a7a]">
                                <span>{products.length} item(s)</span>
                                <span>Total: <span className="font-bold text-lg text-black">{formatCurrency(totalPrice())}</span></span>
                            </div>
                            <button className="w-full bg-black p-3 rounded-md grid place-content-center text-white ">
                                Checkout
                            </button>
                        </div>
                    </motion.div>
                </section>
            }
        </AnimatePresence>
    );
}