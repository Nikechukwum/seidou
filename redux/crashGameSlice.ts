import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Game states
export type GameState = 'idle' | 'betting' | 'flying' | 'crashed';

// Game history item
export interface HistoryItem {
  id: number;
  crashPoint: number;
  timestamp: number;
}

// Player bet
export interface PlayerBet {
  amount: number;
  active: boolean;
  cashedOut: boolean;
  cashedOutAt: number | null;
  winnings: number;
}

interface CrashGameState {
  // Game state
  gameState: GameState;
  multiplier: number;
  crashPoint: number;
  cashoutMultiplier: number;
  nextGameTimestamp: number | null;

  // Player data
  balance: number;
  currentBet: PlayerBet;
  betAmount: number;
  autoCashout: number | null;

  // Game history
  history: HistoryItem[];

  // Audio state (managed here for simplicity)
  isMuted: boolean;
}

const initialState: CrashGameState = {
  // Game state
  gameState: 'idle',
  multiplier: 1,
  crashPoint: 2,
  cashoutMultiplier: 0,
  nextGameTimestamp: null,

  // Player data
  balance: 1000, // Default starting balance for demo
  currentBet: {
    amount: 0,
    active: false,
    cashedOut: false,
    cashedOutAt: null,
    winnings: 0,
  },
  betAmount: 10,
  autoCashout: null,

  // Game history
  history: [],

  // Audio
  isMuted: true,
};

const crashGameSlice = createSlice({
  name: 'crashGame',
  initialState,
  reducers: {
    // Set user email (from auth)
    setUserEmail: (state, action: PayloadAction<string | null>) => {
      // Email is managed by auth slice, this is just for compatibility
    },

    // Set balance directly
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },

    // Update balance (for bets and winnings)
    updateBalance: (state, action: PayloadAction<number>) => {
      state.balance += action.payload;
    },

    // Set bet amount
    setBetAmount: (state, action: PayloadAction<number>) => {
      state.betAmount = action.payload;
    },

    // Set auto cashout
    setAutoCashout: (state, action: PayloadAction<number | null>) => {
      state.autoCashout = action.payload;
    },

    // Toggle mute
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },

    // Initialize game
    initializeGame: (state) => {
      // Generate some random history
      const generateHistory = () => {
        const history: HistoryItem[] = [];
        for (let i = 10; i > 0; i--) {
          const crashPoint =
            Math.random() < 0.3
              ? 1 + Math.random() * 0.5
              : Math.random() < 0.6
              ? 1.5 + Math.random() * 3.5
              : 5 + Math.random() * 45;

          history.push({
            id: i,
            crashPoint: parseFloat(crashPoint.toFixed(2)),
            timestamp: Date.now() - i * 30000,
          });
        }
        return history;
      };

      state.history = generateHistory();
      state.gameState = 'betting';
      state.nextGameTimestamp = Date.now() + 5000;
      state.multiplier = 1;
      state.cashoutMultiplier = 0;
    },

    // Start a round
    startRound: (state, action: PayloadAction<{ crashPoint: number; duration: number }>) => {
      state.gameState = 'flying';
      state.multiplier = 1;
      state.crashPoint = action.payload.crashPoint;
      state.cashoutMultiplier = 0;
      state.currentBet = {
        ...state.currentBet,
        active: state.currentBet.active,
        cashedOut: false,
        cashedOutAt: null,
        winnings: 0,
      };
    },

    // Update multiplier
    updateMultiplier: (state, action: PayloadAction<number>) => {
      state.multiplier = action.payload;
    },

    // Place bet
    placeBet: (state, action: PayloadAction<{ amount: number; autoCashout: number | null }>) => {
      const { amount, autoCashout } = action.payload;
      state.balance -= amount;
      state.currentBet = {
        amount,
        active: true,
        cashedOut: false,
        cashedOutAt: null,
        winnings: 0,
      };
      state.autoCashout = autoCashout;
    },

    // Cashout
    cashout: (state) => {
      const winnings = state.currentBet.amount * state.multiplier;
      state.balance += winnings;
      state.currentBet = {
        amount: state.currentBet.amount,
        active: false,
        cashedOut: true,
        cashedOutAt: state.multiplier,
        winnings,
      };
      state.cashoutMultiplier = state.multiplier;
    },

    // End round (crash)
    endRound: (state, action: PayloadAction<number>) => {
      const crashPoint = action.payload;
      state.gameState = 'crashed';
      state.multiplier = crashPoint;
      state.crashPoint = crashPoint;

      // Add to history
      
      const newHistoryItem: HistoryItem = {
        id: Date.now(),
        crashPoint,
        timestamp: Date.now(),
      };
      state.history = [newHistoryItem, ...state.history.slice(0, 9)];

      // Reset bet if not cashed out
      if (state.currentBet.active && !state.currentBet.cashedOut) {
        state.currentBet = {
          ...state.currentBet,
          active: false,
          cashedOut: false,
          cashedOutAt: null,
          winnings: 0,
        };
      }
    },

    // Reset game for next round
    resetGame: (state) => {
      state.gameState = 'betting';
      state.multiplier = 1;
      state.crashPoint = 2;
      state.nextGameTimestamp = Date.now() + 5000;
      state.currentBet = {
        amount: 0,
        active: false,
        cashedOut: false,
        cashedOutAt: null,
        winnings: 0,
      };
      state.cashoutMultiplier = 0;
    },

    // Set game state directly
    setGameState: (state, action: PayloadAction<GameState>) => {
      state.gameState = action.payload;
    },

    // Set next game timestamp
    setNextGameTimestamp: (state, action: PayloadAction<number | null>) => {
      state.nextGameTimestamp = action.payload;
    },
  },
});

export const {
  setUserEmail,
  setBalance,
  updateBalance,
  setBetAmount,
  setAutoCashout,
  toggleMute,
  initializeGame,
  startRound,
  updateMultiplier,
  placeBet,
  cashout,
  endRound,
  resetGame,
  setGameState,
  setNextGameTimestamp,
} = crashGameSlice.actions;

export default crashGameSlice.reducer;