'use client'

import dynamic from 'next/dynamic';
const Wallet = dynamic(() => import('./Wallet'), {
  ssr: false,
});

const WalletPage = () => {
    return ( 
        <Wallet />
     );
}
 
export default WalletPage;