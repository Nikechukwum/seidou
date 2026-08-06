import { createClient } from "@/lib/supabase/client";
import { UpdateUser, PartialUpdateUser } from "@/redux/authSlice";
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
            await fetchUserProfile(data.user?.id)
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

        let storedInterests: string[] = [];
        try {
          storedInterests = JSON.parse(localStorage.getItem('seidou_interests') || '[]');
        } catch {}

        if (data) {
            const interests = data.interests && data.interests.length > 0
                ? data.interests 
                : storedInterests;
            dispatch(UpdateUser({ 
              ...data, 
              interests 
            }))
            dispatch(InitialiseCart(data.cart_items ?? []))
            // Don't redirect here - let the signup/signin pages handle the redirect with the 'from' parameter
        };

        return data;
    };

    const saveInterests = async (interests: string[]) => {
        if (!user) return { error: new Error('No authenticated user') };

        const { error } = await supabase
            .from("users")
            .update({ interests })
            .eq("id", user.id);

        dispatch(PartialUpdateUser({ interests }));

        return { error };
    };

    const needsOnboarding = (userData: { interests?: string[] } | null) => {
        return userData && (!userData.interests || userData.interests.length === 0);
    };

    return {checkSession, isLoading, user, saveInterests}
};

export default useAuth;
