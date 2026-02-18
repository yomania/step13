import { describe, expect, it } from 'vitest';
import { Tile } from '@step13/proto';
import { calculateScore } from './points';

const t = (suit: Tile['suit'], rank: number): Tile => ({ suit, rank: rank as Tile['rank'], isRed: false });

describe('calculateScore', () => {
    it('returns zero for non-winning hand', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 1), t('pin', 2), t('pin', 3),
            t('sou', 1), t('sou', 2), t('sou', 3),
            t('man', 7), t('man', 8), t('man', 9),
            t('z', 1)
        ];

        const result = calculateScore(hand, t('z', 2), false, []);
        expect(result.points).toBe(0);
    });

    it('scores low hand below mangan when minimum is not required', () => {
        const hand: Tile[] = [
            t('man', 2), t('man', 3), t('man', 4),
            t('man', 3), t('man', 4), t('man', 5),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('sou', 4), t('sou', 5), t('sou', 6),
            t('pin', 6)
        ];

        const result = calculateScore(hand, t('pin', 6), false, []);
        expect(result.points).toBeGreaterThan(0);
        expect(result.points).toBeLessThan(8000);
    });

    it('returns baiman when chinitsu hand also satisfies iipeikou', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('man', 3), t('man', 4), t('man', 5),
            t('man', 6), t('man', 7), t('man', 8),
            t('man', 9), t('man', 9), t('man', 9),
            t('man', 1)
        ];

        const result = calculateScore(hand, t('man', 1), false, []);
        expect(result.limitCategory).toBe('Baiman');
        expect(result.points).toBe(16000);
    });

    it('scores chiitoitsu + honitsu as mangan', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 1),
            t('man', 2), t('man', 2),
            t('man', 3), t('man', 3),
            t('man', 4), t('man', 4),
            t('man', 5), t('man', 5),
            t('z', 1), t('z', 1),
            t('z', 2)
        ];

        const result = calculateScore(hand, t('z', 2), false, [], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true
        });

        expect(result.han).toBe(5);
        expect(result.fu).toBe(0);
        expect(result.points).toBe(8000);
        expect(result.yaku).toContain('Chiitoitsu');
        expect(result.yaku).toContain('Honitsu');
    });

    it('includes ittsuu and auto riichi in han preview', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('man', 4), t('man', 5), t('man', 6),
            t('man', 8), t('man', 9),
            t('pin', 1), t('pin', 2), t('pin', 3),
            t('z', 1), t('z', 1)
        ];

        const result = calculateScore(hand, t('man', 7), false, [], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true,
            autoRiichiFallback: true
        });

        expect(result.han).toBe(3);
        expect(result.points).toBe(0);
        expect(result.yaku).toContain('Ittsuu');
        expect(result.yaku).toContain('Riichi (Auto)');
    });

    it('scores user repro hand as honitsu + ittsuu path instead of chiitoitsu', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 1),
            t('man', 2), t('man', 2),
            t('man', 3), t('man', 3),
            t('man', 4), t('man', 5),
            t('man', 7), t('man', 8), t('man', 9),
            t('z', 6), t('z', 6)
        ];

        const result = calculateScore(hand, t('man', 6), false, [t('z', 1)], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true,
            autoRiichiFallback: true
        });

        expect(result.points).toBe(12000);
        expect(result.yaku).toContain('Honitsu');
        expect(result.yaku).toContain('Ittsuu');
        expect(result.yaku).not.toContain('Chiitoitsu');
    });

    it('includes tanyao when hand has only 2-8 number tiles', () => {
        const hand: Tile[] = [
            t('man', 2), t('man', 3), t('man', 4),
            t('pin', 3), t('pin', 4), t('pin', 5),
            t('sou', 4), t('sou', 5), t('sou', 6),
            t('man', 6), t('man', 7), t('man', 8),
            t('pin', 6)
        ];

        const result = calculateScore(hand, t('pin', 6), false, [], {
            requireManganMinimum: false,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true,
            autoRiichiFallback: true
        });

        expect(result.yaku).toContain('Tanyao');
    });

    it('respects includeOmoteDoraInMinimum option', () => {
        const hand: Tile[] = [
            t('man', 3), t('man', 4), t('man', 5),
            t('man', 5), t('man', 6), t('man', 7),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('sou', 2), t('sou', 3), t('sou', 4),
            t('man', 5)
        ];

        const winTile = t('man', 5);
        const doraIndicator = t('man', 4); // dora = 5m

        const withDoraForMinimum = calculateScore(hand, winTile, false, [doraIndicator], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true
        });

        const withoutDoraForMinimum = calculateScore(hand, winTile, false, [doraIndicator], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: false,
            kiriageMangan: true
        });

        expect(withDoraForMinimum.points).toBe(12000);
        expect(withoutDoraForMinimum.points).toBe(0);
    });

    it('adds han for seat wind yakuhai', () => {
        const hand: Tile[] = [
            t('z', 1), t('z', 1), t('z', 1),
            t('man', 2), t('man', 3), t('man', 4),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('sou', 2), t('sou', 3), t('sou', 4),
            t('man', 5)
        ];

        const result = calculateScore(hand, t('man', 5), false, [], {
            seatWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Yakuhai(Seat): z1');
        expect(result.han).toBeGreaterThanOrEqual(1);
    });

    it('does not add round wind yakuhai in 17-step', () => {
        const hand: Tile[] = [
            t('z', 1), t('z', 1), t('z', 1),
            t('man', 2), t('man', 3), t('man', 4),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('sou', 2), t('sou', 3), t('sou', 4),
            t('man', 5)
        ];

        const result = calculateScore(hand, t('man', 5), false, [], {
            seatWind: 'SOUTH',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).not.toContain('Yakuhai(Round): z1');
        expect(result.yaku).not.toContain('Yakuhai(Seat): z1');
    });

    it('includes pinfu for all-sequence hand with non-value pair', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('man', 4), t('man', 5), t('man', 6),
            t('pin', 2), t('pin', 3),
            t('sou', 6), t('sou', 7), t('sou', 8),
            t('pin', 5), t('pin', 5)
        ];

        const result = calculateScore(hand, t('pin', 4), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Pinfu');
    });

    it('does not include pinfu for edge wait (penchan)', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2),
            t('man', 4), t('man', 5), t('man', 6),
            t('pin', 3), t('pin', 4), t('pin', 5),
            t('sou', 6), t('sou', 7), t('sou', 8),
            t('pin', 2), t('pin', 2)
        ];

        const result = calculateScore(hand, t('man', 3), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).not.toContain('Pinfu');
    });

    it('does not include pinfu for kanchan wait', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 3),
            t('man', 4), t('man', 5), t('man', 6),
            t('pin', 3), t('pin', 4), t('pin', 5),
            t('sou', 6), t('sou', 7), t('sou', 8),
            t('pin', 2), t('pin', 2)
        ];

        const result = calculateScore(hand, t('man', 2), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).not.toContain('Pinfu');
    });

    it('includes sanshoku doukou for same-rank triplets in all three suits', () => {
        const hand: Tile[] = [
            t('man', 4), t('man', 4), t('man', 4),
            t('pin', 4), t('pin', 4), t('pin', 4),
            t('sou', 4), t('sou', 4), t('sou', 4),
            t('man', 2), t('man', 3), t('man', 4),
            t('pin', 5)
        ];

        const result = calculateScore(hand, t('pin', 5), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('SanshokuDoukou');
    });

    it('includes sanshoku doujun for same sequence in all three suits', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 1), t('pin', 2), t('pin', 3),
            t('sou', 1), t('sou', 2), t('sou', 3),
            t('man', 4), t('man', 5), t('man', 6),
            t('pin', 7)
        ];

        const result = calculateScore(hand, t('pin', 7), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('SanshokuDoujun');
    });

    it('includes toitoi and sanankou for triplet hand', () => {
        const hand: Tile[] = [
            t('man', 2), t('man', 2), t('man', 2),
            t('pin', 3), t('pin', 3), t('pin', 3),
            t('sou', 4), t('sou', 4), t('sou', 4),
            t('z', 1), t('z', 1), t('z', 1),
            t('pin', 5)
        ];

        const result = calculateScore(hand, t('pin', 5), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Toitoi');
        expect(result.yaku).toContain('Sanankou');
    });

    it('includes chanta', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 7), t('pin', 8), t('pin', 9),
            t('sou', 1), t('sou', 2), t('sou', 3),
            t('z', 1), t('z', 1), t('z', 1),
            t('z', 2)
        ];

        const result = calculateScore(hand, t('z', 2), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Chanta');
    });

    it('includes junchan', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 1),
            t('man', 7), t('man', 8), t('man', 9),
            t('pin', 1), t('pin', 2), t('pin', 3),
            t('pin', 7), t('pin', 8), t('pin', 9),
            t('sou', 1), t('sou', 2)
        ];

        const result = calculateScore(hand, t('sou', 3), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Junchan');
    });

    it('includes honroutou', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 1), t('man', 1),
            t('pin', 9), t('pin', 9), t('pin', 9),
            t('sou', 1), t('sou', 1), t('sou', 1),
            t('z', 1), t('z', 1), t('z', 1),
            t('z', 5)
        ];

        const result = calculateScore(hand, t('z', 5), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Honroutou');
    });

    it('includes shousangen', () => {
        const hand: Tile[] = [
            t('z', 5), t('z', 5), t('z', 5),
            t('z', 6), t('z', 6), t('z', 6),
            t('z', 7), t('z', 7),
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 1), t('pin', 2)
        ];

        const result = calculateScore(hand, t('pin', 3), false, [], {
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Shousangen');
    });

    it('includes both pinfu and tanyao when all pinfu conditions are met with simples only', () => {
        const hand: Tile[] = [
            t('man', 2), t('man', 3), t('man', 4),
            t('man', 3), t('man', 4), t('man', 5),
            t('pin', 4), t('pin', 5), t('pin', 6),
            t('sou', 5), t('sou', 6),
            t('pin', 6), t('pin', 6)
        ];

        const result = calculateScore(hand, t('sou', 7), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Pinfu');
        expect(result.yaku).toContain('Tanyao');
    });

    it('includes pinfu but excludes tanyao when terminal tile exists', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('man', 4), t('man', 5), t('man', 6),
            t('pin', 2), t('pin', 3),
            t('sou', 6), t('sou', 7), t('sou', 8),
            t('pin', 5), t('pin', 5)
        ];

        const result = calculateScore(hand, t('pin', 4), false, [], {
            seatWind: 'EAST',
            roundWind: 'EAST',
            autoRiichiFallback: false
        });

        expect(result.yaku).toContain('Pinfu');
        expect(result.yaku).not.toContain('Tanyao');
    });
    it('scores 4han 40fu as mangan (tanyao + sanshoku + riichi, kanchan wait)', () => {
        // 손패: 2m 2m 2m 4m 2p 3p 4p 5p 6p 7p 2s 3s 4s → 3m 칸짱 대기
        // 분해: 2m2m(머리) + 234m(순자) + 234p + 567p + 234s
        // 역: 탕야오(1) + 삼색동순(2) + 리치(1) = 4판, 40부 → 만관
        const hand: Tile[] = [
            t('man', 2), t('man', 2), t('man', 2), t('man', 4),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('pin', 5), t('pin', 6), t('pin', 7),
            t('sou', 2), t('sou', 3), t('sou', 4)
        ];

        const result = calculateScore(hand, t('man', 3), false, [], {
            requireManganMinimum: true,
            includeOmoteDoraInMinimum: true,
            kiriageMangan: true,
            autoRiichiFallback: true
        });

        expect(result.yaku).toContain('Tanyao');
        expect(result.yaku).toContain('SanshokuDoujun');
        expect(result.yaku).toContain('Riichi (Auto)');
        expect(result.han).toBe(4);
        expect(result.fu).toBe(40);
        expect(result.points).toBe(8000);
        expect(result.limitCategory).toBe('Mangan');
    });

    it('fu adds wait-based fu on top of base 30, and chiitoitsu keeps minimum 30', () => {
        // 일반 핸드: z1 단기대기로 +2부가 붙어 40부(올림) 기대
        const standardHand: Tile[] = [
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 1), t('pin', 2), t('pin', 3),
            t('sou', 1), t('sou', 2), t('sou', 3),
            t('man', 7), t('man', 8), t('man', 9),
            t('z', 1)
        ];
        const stdResult = calculateScore(standardHand, t('z', 1), false, []);
        // 화료 성립 확인 후 부수 검증
        expect(stdResult.han).toBeGreaterThan(0);
        expect(stdResult.fu).toBe(40);

        // 치또이쯔도 론 최소 30부 적용
        const chiitoiHand: Tile[] = [
            t('man', 1), t('man', 1),
            t('man', 2), t('man', 2),
            t('man', 3), t('man', 3),
            t('pin', 4), t('pin', 4),
            t('pin', 5), t('pin', 5),
            t('sou', 6), t('sou', 6),
            t('z', 7)
        ];
        const chiiResult = calculateScore(chiitoiHand, t('z', 7), false, []);
        expect(chiiResult.fu).toBe(30);
    });

    it('validates fu handling for 4han 30fu, 4han 40fu, and 5han no-fu-display', () => {
        // 4판 30부: 탕야오 + 핑후 + 이페코 + 리치(자동)
        const hand4Han30Fu: Tile[] = [
            t('man', 2), t('man', 3), t('man', 4),
            t('man', 2), t('man', 3), t('man', 4),
            t('pin', 4), t('pin', 5), t('pin', 6),
            t('sou', 2), t('sou', 2),
            t('sou', 6), t('sou', 7)
        ];
        const result4Han30Fu = calculateScore(hand4Han30Fu, t('sou', 8), false, [], {
            autoRiichiFallback: true
        });
        expect(result4Han30Fu.han).toBe(4);
        expect(result4Han30Fu.fu).toBe(30);

        // 4판 40부: 탕야오 + 삼색동순 + 리치(자동), 칸짱 대기(+2부)
        const hand4Han40Fu: Tile[] = [
            t('man', 2), t('man', 2), t('man', 2), t('man', 4),
            t('pin', 2), t('pin', 3), t('pin', 4),
            t('pin', 5), t('pin', 6), t('pin', 7),
            t('sou', 2), t('sou', 3), t('sou', 4)
        ];
        const result4Han40Fu = calculateScore(hand4Han40Fu, t('man', 3), false, [], {
            autoRiichiFallback: true
        });
        expect(result4Han40Fu.han).toBe(4);
        expect(result4Han40Fu.fu).toBe(40);

        // 5판(내부 30부형): 4판 30부 구성 + 도라 1
        // 5판 이상은 부수 표시/검증 대상이 아니므로 fu는 0으로 노출되어야 함
        const result5Han30FuType = calculateScore(hand4Han30Fu, t('sou', 8), false, [t('pin', 3)], {
            autoRiichiFallback: true
        });
        expect(result5Han30FuType.han).toBe(5);
        expect(result5Han30FuType.fu).toBe(0);
    });

    it('detects kokushi musou as yakuman with fast path scoring', () => {
        const hand: Tile[] = [
            t('man', 1), t('man', 9),
            t('pin', 1), t('pin', 9),
            t('sou', 1), t('sou', 9),
            t('z', 1), t('z', 2), t('z', 3), t('z', 4), t('z', 5), t('z', 6), t('z', 7)
        ];

        const result = calculateScore(hand, t('z', 7), false, [], {
            requireManganMinimum: true,
            autoRiichiFallback: true
        });

        expect(result.yaku).toContain('KokushiMusou');
        expect(result.points).toBe(32000);
        expect(result.limitCategory).toBe('Yakuman');
    });

    it('detects daisangen as yakuman', () => {
        const hand: Tile[] = [
            t('z', 5), t('z', 5), t('z', 5),
            t('z', 6), t('z', 6), t('z', 6),
            t('z', 7), t('z', 7), t('z', 7),
            t('man', 1), t('man', 2), t('man', 3),
            t('pin', 9)
        ];

        const result = calculateScore(hand, t('pin', 9), false, []);
        expect(result.yaku).toContain('Daisangen');
        expect(result.points).toBe(32000);
        expect(result.limitCategory).toBe('Yakuman');
    });

    it('detects daisushi as yakuman', () => {
        const hand: Tile[] = [
            t('z', 1), t('z', 1), t('z', 1),
            t('z', 2), t('z', 2), t('z', 2),
            t('z', 3), t('z', 3), t('z', 3),
            t('z', 4), t('z', 4), t('z', 4),
            t('man', 5)
        ];

        const result = calculateScore(hand, t('man', 5), false, []);
        expect(result.yaku).toContain('Daisushi');
        expect(result.points).toBe(32000);
        expect(result.limitCategory).toBe('Yakuman');
    });
});
