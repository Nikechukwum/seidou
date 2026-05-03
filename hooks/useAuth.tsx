import { createClient } from "@/lib/supabase/client";
import { UpdateUser } from "@/redux/authSlice";
import { InitialiseCart } from "@/redux/cartSlice";
import { RootState } from "@/redux/store";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const useAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const dispatch = useDispatch();
    const { user } = useSelector((state: RootState) => state.auth);

    const checkSession = async (enforceSignIn:boolean = true) => {
        setIsLoading(true)
        const { data } = await supabase.auth.getUser();

        if (!data.user && enforceSignIn) {
            const currentPath = `${window.location.pathname}${window.location.search}`
            sessionStorage.setItem('userNav', currentPath)
            router.replace("/signin");
            return;
        }
        if(!user && data.user){
            fetchUserProfile(data.user?.id)
        }
        setIsLoading(false);
        return data.user?.id
    };

    const fetchUserProfile = async (id: string) => {
        const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

        if (data) {
            dispatch(UpdateUser(data))
            dispatch(InitialiseCart(data.cart_items ?? []))
        };
    };

    return {checkSession, isLoading}
};

export default useAuth;
