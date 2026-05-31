import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  // Bumped on every showToast so the Toast component can restart its
  // auto-dismiss timer even when the same message is fired twice in a row.
  id: number;
}

const initialState: ToastState = {
  visible: false,
  message: '',
  type: 'success',
  id: 0,
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<{ message: string; type: ToastType }>) {
      state.visible = true;
      state.message = action.payload.message;
      state.type = action.payload.type;
      state.id += 1;
    },
    hideToast(state) {
      state.visible = false;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;
