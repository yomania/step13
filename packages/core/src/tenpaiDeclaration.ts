import { calculateScore, calculateShanten } from '@step13/scoring';
import { Tile } from '@step13/proto';
import { RULES, WindSeat } from './rules';
import { RulesetName } from './engine/rulesets';

export type TenpaiDeclarationRejectReason =
    | 'missing_tile'
    | 'invalid_hand'
    | 'not_tenpai'
    | 'furiten'
    | 'no_yaku_wait';

export type TenpaiDeclarationCandidate = {
    tile: Tile;
    waits: string[];
    declareable: boolean;
    rejectReason: TenpaiDeclarationRejectReason | null;
};

type DeclarationInput = {
    turnTiles: Tile[];
    discardedTiles: Tile[];
    doraIndicators: Tile[];
    ruleset: RulesetName;
    seatWind: WindSeat;
    tileId: string;
};

const SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

function toTileKey(tile: Tile): string {
    return `${tile.suit}-${tile.rank}`;
}

function getWinningWaitKeys(hand: Tile[]): string[] {
    if (hand.length !== RULES.ten.initialHandSize) {
        return [];
    }

    const waits: string[] = [];
    for (const suit of SUITS) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const wait: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            if (calculateShanten([...hand, wait]) === -1) {
                waits.push(toTileKey(wait));
            }
        }
    }
    return waits;
}

function buildDeclarationCandidate(input: DeclarationInput): TenpaiDeclarationCandidate {
    let removedTile: Tile | null = null;
    const hand = input.turnTiles.filter((tile) => {
        if (!removedTile && tile.id === input.tileId) {
            removedTile = tile;
            return false;
        }
        return true;
    });

    if (!removedTile) {
        return {
            tile: { suit: 'z', rank: 1, isRed: false, id: input.tileId },
            waits: [],
            declareable: false,
            rejectReason: 'missing_tile'
        };
    }

    if (hand.length !== RULES.ten.initialHandSize) {
        return {
            tile: removedTile,
            waits: [],
            declareable: false,
            rejectReason: 'invalid_hand'
        };
    }

    const waits = getWinningWaitKeys(hand);
    if (waits.length === 0) {
        return {
            tile: removedTile,
            waits,
            declareable: false,
            rejectReason: 'not_tenpai'
        };
    }

    const discardKeys = new Set(input.discardedTiles.map((tile) => toTileKey(tile)));
    if (waits.some((key) => discardKeys.has(key))) {
        return {
            tile: removedTile,
            waits,
            declareable: false,
            rejectReason: 'furiten'
        };
    }

    const hasYakuWait = waits.some((key) => {
        const [suit, rankRaw] = key.split('-');
        const waitTile: Tile = {
            suit: suit as Tile['suit'],
            rank: Number(rankRaw) as Tile['rank'],
            isRed: false
        };
        const score = calculateScore(hand, waitTile, false, input.doraIndicators, {
            seatWind: input.seatWind === 'EAST' ? 'EAST' : 'WEST',
            roundWind: 'EAST',
            autoRiichiFallback: input.ruleset === 'ten_attack_defense'
        });
        return score.points > 0 && score.yaku.length > 0;
    });

    return {
        tile: removedTile,
        waits,
        declareable: hasYakuWait,
        rejectReason: hasYakuWait ? null : 'no_yaku_wait'
    };
}

export function evaluateTenpaiDeclaration(input: DeclarationInput): TenpaiDeclarationCandidate {
    return buildDeclarationCandidate(input);
}

export function listTenpaiDeclarationCandidates(
    input: Omit<DeclarationInput, 'tileId'>
): TenpaiDeclarationCandidate[] {
    return input.turnTiles.map((tile) => buildDeclarationCandidate({ ...input, tileId: tile.id ?? '' }));
}
