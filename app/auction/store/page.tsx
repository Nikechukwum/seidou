'use client'

import dynamic from 'next/dynamic';
const AuctionStore = dynamic(() => import('./AuctionStore'), {
  ssr: false,
});

const AuctionStorePage = () => {
    return ( 
        <AuctionStore />
     );
}
 
export default AuctionStorePage;