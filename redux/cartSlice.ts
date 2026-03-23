import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ItemType {
    id: string, 
    image: string,
    title: string,
    price: number, 
    quantity: number,
    variant?: number
}

interface CartState {
    isOpen: boolean,
    products: ItemType[]
}

const initialState: CartState = {
    isOpen: false,
    products: []
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    InitialiseCart(state, action: PayloadAction<ItemType[]>) {
      state.products = action.payload
    },
    ToggleCart(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload
    },
    AddToCart(state, action: PayloadAction<ItemType>) {
      const existingItem = state.products.find(item => item.id === action.payload.id);

      if (existingItem) {
        existingItem.quantity = existingItem.quantity + 1
      } else {
        state.products.push(action.payload)
      }
    },
    RemoveFromCart(state, action: PayloadAction<string>) {
      state.products = state.products.filter( item => item.id !== action.payload)
    },
    IncreaseQuantity(state, action: PayloadAction<string>) {
      const item = state.products.find((item) => item.id === action.payload);
      if (item) {
        item.quantity = item.quantity + 1;
      }
    },
    DecreaseQuantity(state, action: PayloadAction<string>) {
      const item = state.products.find((item) => item.id === action.payload);
  
      if (item) {
        if (item.quantity === 1) {
          state.products = state.products.filter((i) => i.id !== action.payload);
        } else {
          item.quantity = item.quantity - 1;
        }
      }
    },
    ClearCart(state) {
      state.products = []
    },
  },
});

export const { InitialiseCart, ToggleCart, AddToCart, RemoveFromCart, IncreaseQuantity, DecreaseQuantity, ClearCart } = cartSlice.actions;
export default cartSlice.reducer;