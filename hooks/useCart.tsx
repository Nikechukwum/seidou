import { createClient } from "@/lib/supabase/client";
import { AddToCart, DecreaseQuantity, ItemType, RemoveFromCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const useCart = () => {
    const dispatch = useDispatch();
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false)
    const lastSyncTime = useRef<number>(0);
    const throttleLimit = 2000;
    const { user } = useSelector((state: RootState) => state.auth);
    const { products } = useSelector(
        (state: RootState) => state.cart
    );

    const addToCart = async (newItem: ItemType) => {
        const allow = throttler()
        if(!allow) return

        let cartItems = [...products]
        const existingItem = cartItems.find(item => newItem.id === item.id);
        if (existingItem) {
            cartItems = cartItems.map((item)=>{
                if(item.id === existingItem.id){
                    return({...item, quantity: item.quantity + newItem.quantity})
                } else {
                    return item
                }
            })
        } else {
            cartItems.push(newItem)
        }

        const success = await updateCart(cartItems)
        if(success){
            dispatch(AddToCart(newItem));
            return success
        }
    };

    const decreaseQuantity = async (id: string) => {
        const allow = throttler()
        if(!allow) return

        let cartItems = [...products]
        const existingItem = cartItems.find(item => id === item.id);
        if (existingItem) {
            if(existingItem.quantity === 1){
                cartItems = cartItems.filter((item) => item.id !== id)
            } else {
                cartItems = cartItems.map((item)=>{
                    if(item.id === existingItem.id){
                        return({...item, quantity: item.quantity - 1})
                    } else {
                        return item
                    }
                })
            }
        }

        const success = await updateCart(cartItems)
        if(success){
            dispatch(DecreaseQuantity(id));
            return success
        }
    };

    const removeFromCart = async (id: string) => {
        const allow = throttler()
        if(!allow) return

        let cartItems = [...products]
        cartItems = cartItems.filter((item) => item.id !== id)
        
        const success = await updateCart(cartItems)
            if(success){
                dispatch(RemoveFromCart(id))
                return success
            }
    }

    const updateCart = async (cartItems: ItemType[]) => {
        setIsLoading(true)
        try {
            const { error: updateError } = await supabase
            .from('users')
            .update({ cart_items: cartItems })
            .eq('id', user?.id);

            if (updateError) throw updateError;
            return true

        } catch (error: any) {
            console.error("Error updating cart:", error.message);
        } finally {
            setIsLoading(false)
        }
    };

    const throttler = () => {
        const now = Date.now();
        if (now - lastSyncTime.current > throttleLimit) {
            lastSyncTime.current = now;
            return true
        } else {return false}
    }


    return {addToCart, removeFromCart, decreaseQuantity, isLoading}
};

export default useCart;
