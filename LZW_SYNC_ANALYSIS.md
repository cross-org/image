# LZW Synchronization Issue Analysis

## Problem Statement
The GIF LZW encoder and decoder have a code size increase synchronization issue that affects edge cases, particularly simple patterns with low minCodeSize values (e.g., 2-color, 4-color patterns).

## Root Cause
The encoder and decoder increase code size at slightly different times:

### Encoder Behavior
1. Writes code for current buffer
2. Adds new dictionary entry at `nextCode`
3. Increments `nextCode`
4. Checks if `nextCode == (1 << codeSize)`, increases code size if true
5. NEXT code written uses the NEW code size

### Decoder Behavior  
1. Reads code with current code size
2. Outputs the decoded data
3. If `prevCode` exists, adds new dictionary entry at `nextCode`
4. Increments `nextCode`
5. Checks if `nextCode == (1 << codeSize)`, increases code size if true
6. NEXT code read uses the NEW code size

### The Issue
The decoder doesn't add a dictionary entry for the FIRST code after CLEAR (when `prevCode` is null), but the encoder DOES add an entry. This means the decoder's `nextCode` is always one behind the encoder's `nextCode` at any given point.

When both check `nextCode == threshold`:
- Encoder at code N: nextCode = M, checks M == threshold
- Decoder at code N: nextCode = M-1, checks (M-1) == threshold (WRONG!)

## Test Cases That Fail
- minCodeSize=2 (4 colors): Pattern [0,1,2,3,0,1,2,3]
- minCodeSize=1 (2 colors): Pattern [0,1,0,1,0,1,0,1]

## Solution Approaches Attempted

### Approach 1: Use `nextCode + 1` in Decoder
Check `(nextCode + 1) == threshold` to compensate for being one behind.
- **Issue**: Fails for minCodeSize=1 where nextCode starts at 4 and threshold is 4

### Approach 2: Different Check for First Code
Use `(nextCode + 2)` when prevCode is null, `(nextCode + 1)` otherwise.
- **Issue**: Code size increases too early, causing bit stream misalignment

### Approach 3: Check After Each Dict Entry
Move the threshold check inside the dict-adding logic.
- **Issue**: Same synchronization problems persist

## Working Reference: TIFF LZW
The TIFF LZW implementation works correctly because it:
1. Uses MSB-first bit ordering (different from GIF's LSB-first)
2. Uses explicit threshold values (512, 1024, 2048) instead of formula
3. Always starts with codeSize=9, not variable minCodeSize+1

## Recommended Solution
The correct fix requires careful analysis of the EXACT timing of when:
1. The encoder adds dict entries relative to code writes
2. The decoder adds dict entries relative to code reads
3. Both parties check and increase code size

The synchronization must account for:
- The one-entry offset (decoder doesn't add entry for first code)
- The exact sequence of operations in each iteration
- Edge cases where nextCode equals or is near the threshold at initialization

## References
- GIF89a Specification
- LZW Patent (expired)
- Working implementations in other languages/libraries

## Status
- Added `nextCode` tracking to decoder
- Changed both encoder and decoder to use `nextCode == threshold` check
- Tests still failing, indicating the synchronization logic needs refinement
- The core issue is understood but the exact fix requires more careful implementation
