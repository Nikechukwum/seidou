'use client'
import useAuth from "@/hooks/useAuth";
import useCart from "@/hooks/useCart";
import { DecreaseQuantity, IncreaseQuantity, RemoveFromCart, ToggleCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { formatCurrency } from "@/utils/helpers";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, Info, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, PanInfo } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CartItem } from "./CartItem";


export const Cart = ({}) => {
    const selfRef = useRef<HTMLDivElement>(null)
    const dispatch = useDispatch()
    const [checkoutPage, setCheckoutPage] = useState(false)
    const {isOpen, products} = useSelector(
        (state: RootState) => state.cart
    );
    const {checkSession} = useAuth()

    const subTotalPrice = () => {
        let total = 0
        products.forEach((item)=>{
            total += (item.price * item.quantity)
        })

        return total
    }

    const serviceFee = () => {
        return subTotalPrice() * 0.25
    }

    const totalPrice = () => {
        return subTotalPrice() + serviceFee()
    }

    const totalQuantity = () => {
        let total = 0
        products.forEach((item)=>{
            total += item.quantity
        })

        return total
    }


    useEffect(()=>{
        checkSession(false)
    }, [])

    return ( 
        <AnimatePresence>
            {isOpen && 
            <>
                {!checkoutPage? 
                    <section ref={selfRef} className="fixed max-w-md -translate-x-1/2 -translate-y-1/2 z-12 left-1/2 top-1/2 h-dvh w-full overscroll-none overflow-hidden">
                        <motion.div initial={{y: '10%', opacity: 0}} animate={{y: 0, opacity: 1, transition:{duration: 0.3}}} exit={{y: '10%', opacity: 0, transition:{duration: 0.3}}}
                        onClick={(e)=>{e.stopPropagation()}} className="h-dvh w-full bg-white relative flex-col flex justify-between">
                            <div className="relative shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-[#f0f0f0]">
                                <button onClick={()=>{dispatch(ToggleCart(false))}} className="absolute text-black top-1/2 left-5 -translate-y-1/2 p-2">
                                    <X strokeWidth={2} /> 
                                </button>
                                Bag
                            </div>
                            <div className="grow p-3 overflow-y-scroll space-y-4 pb-10">
                                {products.map((item)=>{
                                    return(
                                        <CartItem key={item.id} item={item}/>
                                    )
                                })}
                            </div>
                            <div className="h-fit shrink-0 py-5 px-3 w-full">
                                <div className="mb-5 flex justify-between items-center text-[#7a7a7a]">
                                    <span>{totalQuantity()} item(s)</span>
                                    <span>Subtotal: <span className="font-bold text-lg text-black">{formatCurrency(subTotalPrice())}</span></span>
                                </div>
                                <button onClick={()=>{setCheckoutPage(true)}} className="w-full bg-black p-3 rounded-lg grid place-content-center text-white ">
                                    Checkout
                                </button>
                            </div>
                        </motion.div>
                    </section>
                    :
                    <section ref={selfRef} className="fixed max-w-md -translate-x-1/2 -translate-y-1/2 z-12 left-1/2 top-1/2 w-full overscroll-none touch-none">
                        <motion.div initial={{y: '10%', opacity: 0}} animate={{y: 0, opacity: 1, transition:{duration: 0.3}}} exit={{y: '10%', opacity: 0, transition:{duration: 0.3}}}
                        onClick={(e)=>{e.stopPropagation()}} className="w-full bg-white min-h-dvh ">
                            {/* Header */}
                            <div className="relative shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-[#f0f0f0] mb-5">
                                <button onClick={()=>{setCheckoutPage(false)}} className="absolute text-black top-1/2 left-3 -translate-y-1/2 p-2">
                                    <ChevronLeft size={30} strokeWidth={1.5} /> 
                                </button>
                                Checkout
                            </div>
                            
                            <div className="space-y-4 px-3 mb-8">
                                {/* Delivery Section */}
                                <div className="bg-white rounded-xl p-4 shadow-lg shadow-black/5 border border-[#e8e8e8]">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-lg font-semibold">Delivery</span>
                                    <ChevronRight size={20} className="text-gray-400" />
                                </div>
                                <p className="text-gray-400 text-sm"></p>
                                </div>

                                {/* Wallet Section */}
                                <div className="bg-white rounded-xl p-4 shadow-lg shadow-black/5 border border-[#e8e8e8]">
                                    <span className="text-lg font-semibold block mb-4">Wallet</span>
                                    <div className="flex justify-between items-center">
                                        <span className="">Game wallet</span>
                                        <span className="text-gray-900 font-semibold">₦0</span>
                                    </div>
                                    <div className="flex justify-center mt-2">
                                        <ArrowLeftRight size={20} className="text-gray-400" />
                                    </div>
                                </div>

                                {/* Summary Section */}
                                <div className="bg-white rounded-xl p-4 shadow-lg shadow-black/5 border border-[#e8e8e8]">
                                    <h2 className="text-lg font-semibold mb-4">Summary</h2>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="">Subtotal</span>
                                            <Info size={16} className="fill-gray-400 text-white" />
                                        </div>
                                        <span className="font-semibold">{formatCurrency(subTotalPrice())}</span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="">Service Fee</span>
                                            <Info size={16} className="fill-gray-400 text-white" />
                                        </div>
                                        <span className="font-semibold">{formatCurrency(serviceFee())}</span>
                                        </div>

                                        <div className="flex justify-between items-center font-semibold text-black mt-6 py-1 border-dashed border-b-2 border-[#e8e8e8]">
                                            <span>{totalQuantity()} item(s)</span>
                                            <span className="text-black font-bold">Total: <span className="font-bold ml-1 text-lg text-orange-400">{formatCurrency(totalPrice())}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button Section */}
                            <div className="px-3 w-full h-fit">
                                <button className="w-full bg-[#0aad53] font-bold p-3 rounded-lg grid place-content-center text-white">
                                    Submit Order
                                </button>
                            </div>
                        </motion.div>
                    </section>
                }
            </>
            }
        </AnimatePresence>
    );
}