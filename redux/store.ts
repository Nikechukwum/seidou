import { configureStore } from '@reduxjs/toolkit'
import cartSliceReducer from './cartSlice'
import authSliceReducer from './authSlice'
import feedSliceReducer from './feedSlice'

export const store = configureStore({
  reducer: {
    cart: cartSliceReducer,
    auth: authSliceReducer,
    feed: feedSliceReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch