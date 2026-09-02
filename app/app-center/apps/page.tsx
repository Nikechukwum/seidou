'use client'
import BigCard from "@/components/BigCard";
import { PageLayout } from "@/components/PageLayout";
import { useRouter } from "next/navigation";

const AppsPage = () => {
    const router = useRouter();
    
    return ( 
        <PageLayout pageTitle="Apps" className="px-6 space-y-8 bg-[#f5f5f5]">
            <BigCard 
                title="Seidou Social"
                description="Watch, upload and share videos"
                buttonText="Open"
                onClick={() => router.push('/app-center/apps/seidou-social')}
            />
        </PageLayout>
    );
}
 
export default AppsPage;