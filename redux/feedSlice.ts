import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HomeProduct } from '@/types';

interface FeedState {
  feed: HomeProduct[];
  hasMore: boolean;
  lastId: string | null;
  activeFilter: string;
}

const initialState: FeedState = {
  feed: [],
  hasMore: true,
  lastId: '',
  activeFilter: 'All',
};

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setFeed(state, action: PayloadAction<HomeProduct[]>) {
      state.feed = action.payload;
    },
    appendToFeed(state, action: PayloadAction<HomeProduct[]>) {
      const combined = [...state.feed, ...action.payload];
      if (combined.length > 40) {
        state.feed = combined.slice(-40);
      } else {
        state.feed = combined;
      }
    },
    clearFeed(state) {
      state.feed = [];
      state.lastId = '';
    },
    setHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
    setLastId(state, action: PayloadAction<string | null>) {
      state.lastId = action.payload;
    },
    resetFeed(state, action: PayloadAction<HomeProduct[]>) {
      state.feed = action.payload;
      state.hasMore = true;
      if (action.payload.length > 0) {
        state.lastId = action.payload[action.payload.length - 1]._id;
      } else {
        state.lastId = null;
      }
    },
    setActiveFilter(state, action: PayloadAction<string>) {
      state.activeFilter = action.payload;
    },
  },
});

export const { setFeed, appendToFeed, clearFeed, setHasMore, setLastId, resetFeed, setActiveFilter } = feedSlice.actions;
export default feedSlice.reducer;
