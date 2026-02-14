import { Tile } from '@step13/proto';

// Simple Shanten Calculator (Simplified for 17-steps / standard 4-mentsu-1-head)
// Returns -1 for Agari (Win), 0 for Tenpai, >0 for Shanten

export function calculateShanten(hand: Tile[]): number {
    if (hand.length < 13) return Infinity; // 13 tiles for standard, 14 for win check

    // Convert to frequency map
    const counts: Record<string, number> = {};
    hand.forEach(t => {
        const key = `${t.suit}${t.rank}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    // Check Kokushi (13 Orphans)
    // Check Chiitoitsu (Seven Pairs)

    // Standard Normal Form (4 sets + 1 pair)
    // Recursive search for best combination
    // This is a placeholder for the algorithm. 
    // For now, returning a mock value or simple check.

    // Prevent unused variable error for now by logging or using it in a dummy way if needed, 
    // but for the mock, we just return 0.
    // To avoid lint error 'counts' is declared but never read:
    // console.log(counts); 

    return 0; // Mock: Always Tenpai for testing
}

export function isTenpai(hand: Tile[]): boolean {
    return calculateShanten(hand) <= 0;
}
