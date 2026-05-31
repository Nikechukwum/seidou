import { createSlice, PayloadAction } from '@reduxjs/toolkit';


export interface LoyaltyReward {
    id: number,
    amount: string
}

export interface UserState {
    id: string,
    firstname: string,
    lastname: string,
    email: string,
    gender: 'male'|'female'|'',
    phone: string,
    dob: string,
    address_line1: string,
    address_line2: string,
    state: string,
    cash_balance: number,
    bidding_balance: number,
    loyalty_rewards: LoyaltyReward[]
}

const initialState: {user: UserState | null} = {
    user: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    
    UpdateUser(state, action: PayloadAction<UserState>) {
      state.user = action.payload
    },
    PartialUpdateUser(state, action: PayloadAction<Partial<UserState>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    ClearUser(state) {
      state.user = null
    },
  },
});

export const { UpdateUser, PartialUpdateUser, ClearUser } = authSlice.actions;
export default authSlice.reducer;