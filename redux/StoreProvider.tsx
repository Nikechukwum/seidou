'use client'

import { FC, ReactNode } from "react";
import { store } from './store'
import { Provider } from 'react-redux'

interface CoreProviderProps {
    children: ReactNode
}
 
const StoreProvider: FC<CoreProviderProps> = ({children}) => {
    
    return (
        <Provider store={store}>
            {children}
        </Provider>
     );
}
 
export default StoreProvider;