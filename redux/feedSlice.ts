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
      const seen = new Set<string>();
      state.feed = action.payload.filter(item => {
        if (seen.has(item._id)) return false;
        seen.add(item._id);
        return true;
      });
    },
    appendToFeed(state, action: PayloadAction<HomeProduct[]>) {
      const seen = new Set<string>();
      const combined = [...state.feed, ...action.payload];
      const deduped = combined.filter(item => {
        if (seen.has(item._id)) return false;
        seen.add(item._id);
        return true;
      });
      if (deduped.length > 40) {
        state.feed = deduped.slice(-40);
      } else {
        state.feed = deduped;
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
      const seen = new Set<string>();
      state.feed = action.payload.filter(item => {
        if (seen.has(item._id)) return false;
        seen.add(item._id);
        return true;
      });
      state.hasMore = true;
      if (state.feed.length > 0) {
        state.lastId = state.feed[state.feed.length - 1]._id;
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
