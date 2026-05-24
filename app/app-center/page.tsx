'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";
import { useRouter } from "next/navigation";

const AppCenterPage = () => {
    const router = useRouter();
    
    return ( 
        <PageLayout pageTitle="App Center" noBackButton className="px-6 space-y-8 bg-[#f5f5f5]">
            <BigCard 
                title="Apps"
                description="Experience a variety of apps designed to enhance your Seidou journey."
                buttonText="Open"
                onClick={() => router.push('/app-center/apps')}
            />

            <BigCard 
                title="Games"
                description="Play exciting games and win big rewards."
                buttonText="Open"
                onClick={() => router.push('/app-center/games')}
            />
        </PageLayout>
    );
}
 
export default AppCenterPage;