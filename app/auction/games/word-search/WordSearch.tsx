'use client'

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/PageLayout"
import { Button } from "@/components/Button"
import { Modal } from "@/components/Modal"
import { useDispatch, useSelector } from "react-redux"
import { RootState } from "@/redux/store"
import { PartialUpdateUser } from "@/redux/authSlice"
import { showToast } from "@/redux/toastSlice"
import { createClient } from "@/lib/supabase/client"
import useAuth from "@/hooks/useAuth"

// Word themes from old implementation
const WORDS_BY_THEME = {
  "Nature's Nook": [
    ["tree", "leaf", "bush", "fern", "vine"],
    ["oak", "pine", "moss", "weed", "rose"],
  ],
  "Sunny Meadows": [
    ["sun", "rose", "grass", "bird", "lake"],
    ["warm", "hike", "calm", "pond", "seed"],
  ],
  "Oceanic Oasis": [
    ["wave", "surf", "fish", "reef", "sand"],
    ["blue", "tide", "dive", "ship", "swim"],
  ],
  "Mountain Majesty": [
    ["peak", "rock", "snow", "view", "claw"],
    ["high", "hill", "cold", "hike", "alps"],
  ],
  "Desert Delight": [
    ["sand", "heat", "dune", "oasis", "palm"],
    ["warm", "arid", "dry", "cool", "cacti"],
  ],
  "Polar Paradise": [
    ["ice", "snow", "seal", "cold", "bear"],
    ["puff", "sled", "flip", "frost", "gale"],
  ],
  "Forest Fantasy": [
    ["tree", "leaf", "bird", "bear", "deer"],
    ["wild", "tall", "deep", "dark", "home"],
  ],
  "Tropical Treasures": [
    ["palm", "rain", "heat", "bird", "frog"],
    ["warm", "tide", "trop", "leaf", "toad"],
  ],
  "River Retreat": [
    ["flow", "bank", "fish", "frog", "duck"],
    ["rush", "cool", "deep", "calm", "raft"],
  ],
  "Jungle Jamboree": [
    ["vine", "frog", "leaf", "bug", "bird"],
    ["wild", "deep", "green", "loud", "home"],
  ],
  "Savannah Serenity": [
    ["grass", "lion", "zebra", "tree", "heat"],
    ["warm", "wild", "dry", "deep", "home"],
  ],
  "Mystic Marsh": [
    ["mud", "frog", "bird", "reel", "lily"],
    ["deep", "tall", "dark", "wild", "leaf"],
  ],
  "Alpine Aura": [
    ["snow", "peak", "bear", "goat", "cold"],
    ["high", "tall", "deep", "wild", "home"],
  ],
  "Urban Eden": [
    ["park", "tree", "bird", "home", "city"],
    ["deep", "wild", "tall", "loud", "warm"],
  ],
  "Arctic Ambiance": [
    ["cold", "snow", "bear", "seal", "ice"],
    ["deep", "tall", "wild", "home", "puff"],
  ],
}

const WORDS_TO_FIND_COUNT = 4
const GAME_DURATION = 20
// Bidding currency awarded for winning a game
const WIN_REWARD = 10000

type Cell = {
  letter: string
  position: { row: number; col: number }
}

// All 8 directions for word search
const DIRECTIONS = [
  { dRow: 0, dCol: 1 },   // horizontal right
  { dRow: 0, dCol: -1 },  // horizontal left
  { dRow: 1, dCol: 0 },   // vertical down
  { dRow: -1, dCol: 0 },  // vertical up
  { dRow: 1, dCol: 1 },   // diagonal down-right
  { dRow: 1, dCol: -1 },  // diagonal down-left
  { dRow: -1, dCol: 1 },  // diagonal up-right
  { dRow: -1, dCol: -1 }, // diagonal up-left
]

type Direction = { dRow: number; dCol: number }

const WordSearch = () => {
  const [grid, setGrid] = useState<string[][]>([])
  const [foundWords, setFoundWords] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [isGameActive, setIsGameActive] = useState(false)
  const [dragCells, setDragCells] = useState<Cell[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [lockedDirection, setLockedDirection] = useState<Direction | null>(null)
  const [wordPositions, setWordPositions] = useState<Record<string, { row: number; col: number }[]>>({})
  const [selectableCells, setSelectableCells] = useState<Set<string>>(new Set())
  const [hintCells, setHintCells] = useState<Set<string>>(new Set())
  const [revealedCells, setRevealedCells] = useState<Map<string, number>>(new Map()) // cell key -> color index
  const [pivotCell, setPivotCell] = useState<{ row: number; col: number } | null>(null)
  const [currentTheme, setCurrentTheme] = useState<string>("")
  const [wordsToFind, setWordsToFind] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [gameResult, setGameResult] = useState<{ won: boolean; message: string }>({ won: false, message: "" })

  // Game setup (attempts + cost per attempt, paid in bidding currency)
  const [setupModalActive, setSetupModalActive] = useState(true)
  const [attemptsInput, setAttemptsInput] = useState("")
  const [costInput, setCostInput] = useState("")
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [costPerAttempt, setCostPerAttempt] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(0)

  const dispatch = useDispatch()
  const supabase = createClient()
  const router = useRouter()
  const { checkSession } = useAuth()
  const { user } = useSelector((state: RootState) => state.auth)

  const gridRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const ROWS = 8
  const COLS = 10

  // Helper to select words based on word length (matching old implementation)
  const selectWordsBasedOnWordLength = (wordsObject: typeof WORDS_BY_THEME, wordLength: number): string[] => {
    const allWords = Object.values(wordsObject).flatMap((theme) =>
      theme.flatMap((words) => words)
    )
    return allWords.filter((word) => word.length === wordLength)
  }

  const initializeGame = useCallback(() => {
    const newGrid: string[][] = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(""))

    const newWordPositions: Record<string, { row: number; col: number }[]> = {}

    // Select random theme
    const themes = Object.keys(WORDS_BY_THEME)
    const randomThemeIndex = Math.floor(Math.random() * themes.length)
    const selectedTheme = themes[randomThemeIndex]
    setCurrentTheme(selectedTheme)

    // Get words from selected theme and remove duplicates
    const themeWords = WORDS_BY_THEME[selectedTheme as keyof typeof WORDS_BY_THEME]
    const flattenedWords = [...new Set(themeWords.flat())]

    // Select words to find and create decoys (matching old implementation logic)
    const wordsToAddToMatrix: string[][] = []
    const wordsToFindArray: string[] = []
    const decoyArray: string[] = []
    const alphabets = ["a", "b", "c", "d", "e", "f", "g", "q", "x", "z"]
    const array1: string[] = []
    const array2: string[] = []
    const availableWords = [...flattenedWords]

    while (array1.length + array2.length < WORDS_TO_FIND_COUNT && availableWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableWords.length)
      const randomWord = availableWords.splice(randomIndex, 1)[0]

      if (array1.length <= array2.length) {
        array1.push(randomWord)
      } else {
        array2.push(randomWord)
      }

      // Create decoys for first 2 words (matching old implementation)
      if (array1.length + array2.length <= 2) {
        let validDecoyLetter = false
        const decoy = [...randomWord]

        while (!validDecoyLetter && alphabets.length > 0) {
          const randomIndexForDecoys = Math.floor(Math.random() * alphabets.length)
          const randomLetterForDecoys = alphabets.splice(randomIndexForDecoys, 1)[0]
          if (decoy[randomWord.length - 1] !== randomLetterForDecoys) {
            decoy[randomWord.length - 1] = randomLetterForDecoys
            validDecoyLetter = true
          }
        }
        if (validDecoyLetter) {
          decoyArray.push(decoy.join(""))
        }
      }
    }

    wordsToAddToMatrix.push(array1, array2, decoyArray)
    wordsToFindArray.push(...array1, ...array2)

    // Convert to uppercase
    const upperCaseWordsToFind = wordsToFindArray.map(w => w.toUpperCase())
    const upperCaseDecoys = decoyArray.map(d => d.toUpperCase())

    const allWordsToPlace = [...upperCaseWordsToFind, ...upperCaseDecoys]

    const getDirection = () => {
      const directions = [
        { dRow: 0, dCol: 1 },
        { dRow: 0, dCol: -1 },
        { dRow: 1, dCol: 0 },
        { dRow: -1, dCol: 0 },
        { dRow: 1, dCol: 1 },
        { dRow: 1, dCol: -1 },
        { dRow: -1, dCol: 1 },
        { dRow: -1, dCol: -1 },
      ]
      return directions[Math.floor(Math.random() * directions.length)]
    }

    // Place words in grid
    allWordsToPlace.forEach((word) => {
      let placed = false
      let attempts = 0
      while (!placed && attempts < 100) {
        const dir = getDirection()
        const randX = Math.floor(Math.random() * ROWS)
        const randY = Math.floor(Math.random() * COLS)

        if (newGrid[randX][randY] === "" || newGrid[randX][randY] === word.charAt(0)) {
          // Check if word fits in this direction
          let fits = true
          for (let k = 0; k < word.length; k++) {
            const newX = randX + dir.dRow * k
            const newY = randY + dir.dCol * k
            if (newX < 0 || newX >= ROWS || newY < 0 || newY >= COLS) {
              fits = false
              break
            }
            if (newGrid[newX][newY] !== "" && newGrid[newX][newY] !== word.charAt(k)) {
              fits = false
              break
            }
          }

          if (fits) {
            for (let k = 0; k < word.length; k++) {
              const newX = randX + dir.dRow * k
              const newY = randY + dir.dCol * k
              newGrid[newX][newY] = word.charAt(k)
            }
            newWordPositions[word] = Array.from({ length: word.length }, (_, i) => ({
              row: randX + dir.dRow * i,
              col: randY + dir.dCol * i,
            }))
            placed = true
          }
        }
        attempts++
      }
    })

    // Fill empty cells with random letters
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (newGrid[row][col] === "") {
          newGrid[row][col] = String.fromCharCode(65 + Math.floor(Math.random() * 26))
        }
      }
    }

    setGrid(newGrid)
    setWordPositions(newWordPositions)
    setWordsToFind(upperCaseWordsToFind)
    setFoundWords([])
    setTimeLeft(GAME_DURATION)
    setIsGameActive(true)
    setDragCells([])
    setIsDragging(false)
    setLockedDirection(null)
    setSelectableCells(new Set())
    setHintCells(new Set())
    setPivotCell(null)
    setShowModal(false)
    setRevealedCells(new Map())
  }, [])

  // Require a signed-in user (redirects to /signin if not) so we can credit
  // winnings / charge for losses. The game starts once the setup is submitted.
  useEffect(() => {
    checkSession()
  }, [])

  // Award bidding currency for a win
  const awardWin = async () => {
    if (!user?.id) return
    const newBalance = (user.bidding_balance ?? 0) + WIN_REWARD
    const { error } = await supabase
      .from("users")
      .update({ bidding_balance: newBalance })
      .eq("id", user.id)
    if (error) {
      dispatch(showToast({ type: "error", message: "Could not award your winnings. Please contact support." }))
      return
    }
    dispatch(PartialUpdateUser({ bidding_balance: newBalance }))
    dispatch(showToast({ type: "success", message: `You won! B ${WIN_REWARD.toLocaleString()} added to your bidding balance.` }))
  }

  // Charge the total (cost per attempt × attempts) once all attempts are lost
  const chargeForLoss = async () => {
    if (!user?.id) return
    const total = totalAttempts * costPerAttempt
    const newBalance = Math.max(0, (user.bidding_balance ?? 0) - total)
    const { error } = await supabase
      .from("users")
      .update({ bidding_balance: newBalance })
      .eq("id", user.id)
    if (error) {
      dispatch(showToast({ type: "error", message: "Could not process your payment. Please contact support." }))
      return
    }
    dispatch(PartialUpdateUser({ bidding_balance: newBalance }))
    dispatch(showToast({ type: "error", message: `Out of attempts. B ${total.toLocaleString()} deducted from your bidding balance.` }))
  }

  // Submit the setup modal: validate, reserve funds, then start the first attempt
  const handleStartGame = () => {
    const attempts = Number(attemptsInput)
    const cost = Number(costInput)

    if (!user?.id) {
      dispatch(showToast({ type: "error", message: "Please sign in to play." }))
      return
    }
    if (!Number.isInteger(attempts) || attempts < 1 || !cost || cost < 1) {
      dispatch(showToast({ type: "error", message: "Enter a valid number of attempts and cost per attempt." }))
      return
    }

    const total = attempts * cost
    if ((user.bidding_balance ?? 0) < total) {
      dispatch(showToast({ type: "error", message: `You need B ${total.toLocaleString()} to play. Top up your bidding balance.` }))
      return
    }

    setTotalAttempts(attempts)
    setCostPerAttempt(cost)
    setAttemptsLeft(attempts)
    setSetupModalActive(false)
    initializeGame()
  }

  // Start the next attempt without re-opening setup
  const startNextAttempt = () => {
    setShowModal(false)
    initializeGame()
  }

  // Re-open the setup modal for a brand-new game
  const openSetup = () => {
    setShowModal(false)
    setAttemptsInput("")
    setCostInput("")
    setSetupModalActive(true)
  }

  // Leave the game and go back to the auction games list. This clears the
  // current attempts (not yet persisted — that will come later).
  const handleLeave = () => {
    setShowModal(false)
    setAttemptsLeft(0)
    setTotalAttempts(0)
    setCostPerAttempt(0)
    router.push('/auction/games')
  }

  useEffect(() => {
    if (isGameActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
    } else if (timeLeft === 0 && isGameActive) {
      setIsGameActive(false)
      // Clear any current selection immediately
      setDragCells([])
      setSelectableCells(new Set())
      setPivotCell(null)
      // Reveal all answers with different colors
      revealAllAnswersWithColors()
      // This attempt is lost — use one up
      const remaining = attemptsLeft - 1
      setAttemptsLeft(remaining)
      if (remaining > 0) {
        setGameResult({ won: false, message: "Time's Up!" })
      } else {
        // All attempts exhausted without a win — charge the total now
        setGameResult({ won: false, message: "Out of Attempts" })
        chargeForLoss()
      }
      setTimeout(() => {
        setShowModal(true)
      }, 4500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isGameActive, timeLeft, attemptsLeft])

  // Check for win condition
  useEffect(() => {
    if (foundWords.length === WORDS_TO_FIND_COUNT && isGameActive) {
      setIsGameActive(false)
      setGameResult({ won: true, message: `Congratulations\nYou Win!` })
      setShowModal(true)
      // Winning awards bidding currency; no charge is taken
      awardWin()
    }
  }, [foundWords, isGameActive])

  // Hint system
  useEffect(() => {
    if (!isGameActive) return

    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current)
    }

    setHintCells(new Set())

    const foundCount = foundWords.length
    const totalWords = WORDS_TO_FIND_COUNT

    let hintDelay: number
    let wordsToHint: string[]

    if (foundCount > 0 && foundCount < totalWords - 1) {
      hintDelay = 5000
      const nextWord = wordsToFind.find(w => !foundWords.includes(w))
      wordsToHint = nextWord ? [nextWord] : []
    } else {
      hintDelay = 10000
      const unfoundWords = wordsToFind.filter(w => !foundWords.includes(w))
      const shuffled = [...unfoundWords].sort(() => Math.random() - 0.5)
      wordsToHint = shuffled.slice(0, Math.min(2, shuffled.length))
    }

    if (wordsToHint.length > 0 && foundCount < totalWords) {
      hintTimeoutRef.current = setTimeout(() => {
        const newHintCells = new Set<string>()
        wordsToHint.forEach(word => {
          const positions = wordPositions[word]
          if (positions) {
            positions.forEach(pos => {
              if (!foundWords.some(fw => {
                const fp = wordPositions[fw]
                return fp && fp.some(p => p.row === pos.row && p.col === pos.col)
              })) {
                newHintCells.add(`${pos.row}-${pos.col}`)
              }
            })
          }
        })
        // setHintCells(newHintCells)

        // setTimeout(() => {
        //   setHintCells(new Set())
        // }, 5000)
      }, hintDelay)
    }

    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    }
  }, [foundWords, isGameActive, wordPositions, wordsToFind])

  const revealAllAnswersWithColors = () => {
    // Different colors for each word (matching old implementation)
    // Word 0: green, Word 1: yellow, Word 2: red, Word 3: purple
    const colorClasses = ['foundCell-green', 'foundCell-yellow', 'foundCell-red', 'foundCell-purple']
    const newRevealedCells = new Map<string, number>()
    
    wordsToFind.forEach((word, wordIndex) => {
      const positions = wordPositions[word]
      if (positions) {
        positions.forEach(pos => {
          // Only add if not already found by user
          if (!foundWords.includes(word)) {
            newRevealedCells.set(`${pos.row}-${pos.col}`, wordIndex % colorClasses.length)
          }
        })
      }
    })
    
    setRevealedCells(newRevealedCells)
  }

  const highlightValidDirections = useCallback((pivotRow: number, pivotCol: number) => {
    const newSelectable = new Set<string>()
    
    DIRECTIONS.forEach(dir => {
      for (let i = 1; i < Math.max(ROWS, COLS); i++) {
        const newRow = pivotRow + dir.dRow * i
        const newCol = pivotCol + dir.dCol * i
        
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
          newSelectable.add(`${newRow}-${newCol}`)
        } else {
          break
        }
      }
    })

    setSelectableCells(newSelectable)
  }, [])

  const getCellsInRange = useCallback((pivotRow: number, pivotCol: number, currentRow: number, currentCol: number): Cell[] => {
    const dRow = Math.sign(currentRow - pivotRow)
    const dCol = Math.sign(currentCol - pivotCol)
    
    if (dRow === 0 && dCol === 0) return []
    
    const cells: Cell[] = []
    let row = pivotRow
    let col = pivotCol
    
    const maxIterations = Math.max(ROWS, COLS) + 1
    let iterations = 0
    
    while (iterations < maxIterations) {
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS && grid[row]) {
        cells.push({ letter: grid[row][col], position: { row, col } })
      }
      
      if (row === currentRow && col === currentCol) break
      
      row += dRow
      col += dCol
      iterations++
    }
    
    return cells
  }, [grid])

  // Handle pointer down (mouse and touch)
  const handlePointerDown = (row: number, col: number) => {
    if (!isGameActive) return
    
    setIsDragging(true)
    setLockedDirection(null)
    setPivotCell({ row, col })
    
    const cell: Cell = { letter: grid[row][col], position: { row, col } }
    setDragCells([cell])
    
    highlightValidDirections(row, col)
  }

  // Handle pointer enter (mainly for mouse)
  const handlePointerEnter = (row: number, col: number) => {
    if (!isDragging || !isGameActive) return
    
    const cellKey = `${row}-${col}`
    
    if (selectableCells.has(cellKey) || dragCells.length === 0) {
      if (pivotCell) {
        const dRow = Math.sign(row - pivotCell.row)
        const dCol = Math.sign(col - pivotCell.col)
        
        if (dRow !== 0 || dCol !== 0) {
          setLockedDirection({ dRow, dCol })
        }
        
        const cellsInRange = getCellsInRange(pivotCell.row, pivotCell.col, row, col)
        if (cellsInRange.length > 0) {
          setDragCells(cellsInRange)
        }
      }
    }
  }

  // Handle touch move for touch devices
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isDragging || !isGameActive) return
    event.preventDefault()
    
    const touch = event.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    
    if (element) {
      const cellElement = element.closest('[data-cell]') as HTMLElement
      if (cellElement) {
        const cellData = cellElement.dataset.cell
        if (cellData) {
          const [row, col] = cellData.split('-').map(Number)
          if (!isNaN(row) && !isNaN(col)) {
            const cellKey = `${row}-${col}`
            
            if (selectableCells.has(cellKey) || dragCells.length === 0) {
              if (pivotCell) {
                const dRow = Math.sign(row - pivotCell.row)
                const dCol = Math.sign(col - pivotCell.col)
                
                if (dRow !== 0 || dCol !== 0) {
                  setLockedDirection({ dRow, dCol })
                }
                
                const cellsInRange = getCellsInRange(pivotCell.row, pivotCell.col, row, col)
                if (cellsInRange.length > 0) {
                  setDragCells(cellsInRange)
                }
              }
            }
          }
        }
      }
    }
  }, [isDragging, isGameActive, selectableCells, dragCells.length, pivotCell, getCellsInRange])

  // Handle pointer/touch up
  const handlePointerUp = useCallback(() => {
    if (!isDragging || !isGameActive) return
    setIsDragging(false)
    setLockedDirection(null)
    setSelectableCells(new Set())
    setPivotCell(null)

    const word = dragCells.map((c) => c.letter).join("")
    const reversedWord = word.split("").reverse().join("")

    if (wordsToFind.includes(word) && !foundWords.includes(word)) {
      setFoundWords([...foundWords, word])
    } else if (wordsToFind.includes(reversedWord) && !foundWords.includes(reversedWord)) {
      setFoundWords([...foundWords, reversedWord])
    }

    setDragCells([])
  }, [isDragging, isGameActive, dragCells, wordsToFind, foundWords])

  const isCellSelected = (row: number, col: number) => {
    return dragCells.some((c) => c.position.row === row && c.position.col === col)
  }

  const isCellFound = (row: number, col: number) => {
    return foundWords.some((word) => {
      const positions = wordPositions[word]
      return positions && positions.some((p) => p.row === row && p.col === col)
    })
  }

  const isCellSelectable = (row: number, col: number) => {
    return selectableCells.has(`${row}-${col}`)
  }

  const isCellHint = (row: number, col: number) => {
    return hintCells.has(`${row}-${col}`)
  }

  const getRevealedColorIndex = (row: number, col: number): number | null => {
    return revealedCells.get(`${row}-${col}`) ?? null
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    }
  }, [])

  return (
    <PageLayout pageTitle="Word Search" className="px-4 bg-[#f5f5f5]">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Time: {isGameActive ? `${timeLeft}s` : foundWords.length === WORDS_TO_FIND_COUNT ? "Success!" : "Over!"}</h3>
            {currentTheme && (
            <span className="text-xs font-medium text-gray-500">Theme: {currentTheme}</span>
          )}
          </div>
          {/* {currentTheme && (
            <h3 className="text-xs font-medium text-gray-500 mb-2">Theme: {currentTheme}</h3>
          )} */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-500">Words to find:</h3>
            <span className="text-xs font-medium text-gray-500">Attempts left: {attemptsLeft}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {wordsToFind.map((word) => {
              const isFound = foundWords.includes(word)
              return (
                <span
                  key={word}
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    isFound
                      ? "bg-blue-400 text-white line-through"
                      : "nth-1:bg-green-100 nth-1:text-green-700 nth-2:bg-yellow-100 nth-2:text-yellow-700 nth-3:bg-rose-100 nth-3:text-rose-700 nth-4:bg-purple-100 nth-4:text-purple-700"
                  }`}
                >
                  {word}
                </span>
              )
            })}
          </div>
        </div>

        <div
          ref={gridRef}
          className="bg-white rounded-xl px-2 py-3 shadow-sm overflow-x-auto select-none touch-none"
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handlePointerUp}
        >
          <div className="grid grid-cols-10 gap-x-1 gap-y-2.5 w-full mx-auto">
            {grid.map((row, rowIndex) =>
              row.map((letter, colIndex) => {
                const selected = isCellSelected(rowIndex, colIndex)
                const found = isCellFound(rowIndex, colIndex)
                const selectable = isCellSelectable(rowIndex, colIndex)
                const hint = isCellHint(rowIndex, colIndex)
                const revealedColorIndex = getRevealedColorIndex(rowIndex, colIndex)
                
                // Color classes for revealed words
                const revealedColorClasses = [
                  "[--flash-color:var(--color-emerald-400)] animate-reveal-flasher bg-emerald-400 text-white",  // Word 0: green
                  "[--flash-color:var(--color-yellow-400)] animate-reveal-flasher bg-yellow-400 text-white", // Word 1: yellow
                  "[--flash-color:var(--color-rose-400)] animate-reveal-flasher bg-rose-400 text-white",    // Word 2: red
                  "[--flash-color:var(--color-purple-400)] animate-reveal-flasher bg-purple-400 text-white", // Word 3: purple
                ]
                
                let cellClass = "w-full aspect-square flex items-center justify-center text-sm font-bold rounded transition-colors duration-200 "
                
                if (found) {
                  cellClass += "bg-blue-400 text-white"
                } else if (revealedColorIndex !== null) {
                  // Revealed word with specific color (when time's up)
                  cellClass += revealedColorClasses[revealedColorIndex] + ' transition-[background-color] duration-700 delay-[1.5s]'
                } else if (selected) {
                  cellClass += "bg-blue-400 text-white scale-110 rounded-md"
                } else if (hint) {
                  cellClass += "bg-yellow-200 text-gray-800 animate-pulse"
                } else if (selectable) {
                  cellClass += "bg-gray-200 hover:bg-gray-200 cursor-pointer"
                } else if (!isGameActive) {
                  cellClass += "text-black/30 duration-500 bg-gray-100"
                } else {
                  cellClass += "bg-gray-100 hover:bg-gray-200"
                }
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    data-cell={`${rowIndex}-${colIndex}`}
                    onPointerDown={() => handlePointerDown(rowIndex, colIndex)}
                    onPointerEnter={() => handlePointerEnter(rowIndex, colIndex)}
                    className={cellClass}
                  >
                    {letter}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <Modal isActive={showModal} setIsActive={setShowModal}>
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold whitespace-pre-line">{gameResult.message}</h2>
            <p className="text-gray-600">
              You found {foundWords.length} out of {WORDS_TO_FIND_COUNT} words.
            </p>
            {gameResult.won ? (
              <p className="text-green-600 font-semibold">You won B {WIN_REWARD.toLocaleString()}!</p>
            ) : attemptsLeft === 0 ? (
              <p className="text-red-600 font-semibold">
                B {(totalAttempts * costPerAttempt).toLocaleString()} was deducted from your balance.
              </p>
            ) : (
              <p className="text-gray-500 font-medium">{attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left.</p>
            )}
            {!gameResult.won && attemptsLeft > 0 ? (
              <Button
                text={`Try Again (${attemptsLeft} left)`}
                onClick={startNextAttempt}
                classname="w-full"
              />
            ) : (
              <Button
                text="New Game"
                onClick={openSetup}
                classname="w-full"
              />
            )}
            <Button
              text="Leave Word Search"
              bordered
              onClick={handleLeave}
              classname="w-full"
            />
          </div>
        </Modal>

        {/* Setup modal — collects attempts and cost per attempt before play */}
        <Modal isActive={setupModalActive} setIsActive={setSetupModalActive}>
          <h2 className="text-xl font-bold text-[#111827] mb-2">Set up your game</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Choose how many attempts you want and the cost per attempt. <br />
            Win any attempt to earn B {WIN_REWARD.toLocaleString()} — you&apos;re only charged if you use up every attempt without winning.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase text-gray-400 mb-1">Number of attempts</label>
              <input
                type="number"
                min={1}
                value={attemptsInput}
                onChange={(e) => setAttemptsInput(e.target.value)}
                placeholder="e.g. 3"
                className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-gray-400 mb-1">Cost per attempt (B)</label>
              <input
                type="number"
                min={1}
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-4 py-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827]"
              />
            </div>
            {Number(attemptsInput) > 0 && Number(costInput) > 0 && (
              <p className="text-sm text-gray-600">
                Total at stake: <span className="font-bold">B {(Number(attemptsInput) * Number(costInput)).toLocaleString()}</span>
              </p>
            )}
            <Button text="Start Game" classname="w-full py-3" onClick={handleStartGame} />
          </div>
        </Modal>
      </div>
    </PageLayout>
  )
}

export default WordSearch