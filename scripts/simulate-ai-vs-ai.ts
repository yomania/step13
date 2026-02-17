import FakeTimers from '@sinonjs/fake-timers';
import { createActor } from 'xstate';
import { createGameMachine } from '@step13/core';
import type { Difficulty } from '@step13/scoring';
import { Bot } from '../apps/server/src/Bot';

type TestClock = ReturnType<typeof FakeTimers.install>;

type SimulationOptions = {
    matches: number;
    startSeed: number;
    botA: Difficulty;
    botB: Difficulty;
};

type MatchResult = {
    seed: number;
    winner: string | null;
    scores: Record<string, number>;
    roundsPlayed: number;
};

function parseDifficulty(raw: string | undefined, fallback: Difficulty): Difficulty {
    if (raw === 'EASY' || raw === 'MEDIUM' || raw === 'HARD') return raw;
    return fallback;
}

function parseArgs(argv: string[]): SimulationOptions {
    const pairs = new Map<string, string>();
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) continue;
        pairs.set(key, value);
        i += 1;
    }

    const matches = Number(pairs.get('matches') ?? 20);
    const startSeed = Number(pairs.get('start-seed') ?? 1);

    return {
        matches: Number.isFinite(matches) && matches > 0 ? Math.floor(matches) : 20,
        startSeed: Number.isFinite(startSeed) && startSeed > 0 ? Math.floor(startSeed) : 1,
        botA: parseDifficulty(pairs.get('bot-a'), 'EASY'),
        botB: parseDifficulty(pairs.get('bot-b'), 'HARD')
    };
}

async function runSingleMatch(seed: number, botADifficulty: Difficulty, botBDifficulty: Difficulty): Promise<MatchResult> {
    const clock: TestClock = FakeTimers.install({
        now: Date.now(),
        toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
        shouldClearNativeTimers: true
    });

    try {
        const actor = createActor(createGameMachine({ ruleset: 'classic' }));
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'bot-a' });
        actor.send({ type: 'JOIN', playerId: 'bot-b' });

        // Keep references so subscriptions stay active.
        const botA = new Bot('bot-a', actor as any, 'classic', botADifficulty);
        const botB = new Bot('bot-b', actor as any, 'classic', botBDifficulty);
        void botA;
        void botB;

        actor.send({ type: 'START_MATCH', seed });

        const maxVirtualMs = 4_000_000;
        const tickStepMs = 250;
        let elapsed = 0;

        while (actor.getSnapshot().value !== 'matchEnd' && elapsed < maxVirtualMs) {
            await clock.tickAsync(tickStepMs);
            elapsed += tickStepMs;
        }

        const snapshot = actor.getSnapshot();
        if (snapshot.value !== 'matchEnd') {
            throw new Error(`match did not finish in time (seed=${seed}, elapsedMs=${elapsed})`);
        }

        return {
            seed,
            winner: snapshot.context.winner,
            scores: { ...snapshot.context.scores },
            roundsPlayed: snapshot.context.matchHandIndex
        };
    } finally {
        clock.uninstall();
    }
}

async function runSimulation(options: SimulationOptions) {
    const results: MatchResult[] = [];

    for (let i = 0; i < options.matches; i++) {
        const seed = options.startSeed + i;
        const result = await runSingleMatch(seed, options.botA, options.botB);
        results.push(result);
    }

    const winsA = results.filter((r) => r.winner === 'bot-a').length;
    const winsB = results.filter((r) => r.winner === 'bot-b').length;
    const draws = results.length - winsA - winsB;

    const totalScoreA = results.reduce((acc, r) => acc + (r.scores['bot-a'] ?? 0), 0);
    const totalScoreB = results.reduce((acc, r) => acc + (r.scores['bot-b'] ?? 0), 0);
    const avgScoreA = totalScoreA / results.length;
    const avgScoreB = totalScoreB / results.length;

    console.log(`AI vs AI simulation complete`);
    console.log(`- bot-a difficulty: ${options.botA}`);
    console.log(`- bot-b difficulty: ${options.botB}`);
    console.log(`- matches: ${results.length}`);
    console.log(`- seed range: ${options.startSeed}..${options.startSeed + results.length - 1}`);
    console.log(`- wins (bot-a): ${winsA}`);
    console.log(`- wins (bot-b): ${winsB}`);
    console.log(`- draws: ${draws}`);
    console.log(`- avg score (bot-a): ${avgScoreA.toFixed(2)}`);
    console.log(`- avg score (bot-b): ${avgScoreB.toFixed(2)}`);

    const sample = results.slice(0, Math.min(5, results.length));
    for (const row of sample) {
        console.log(
            `  seed=${row.seed} winner=${row.winner ?? 'draw'} scores=${row.scores['bot-a'] ?? 0}:${row.scores['bot-b'] ?? 0} rounds=${row.roundsPlayed}`
        );
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    await runSimulation(options);
}

main().catch((error) => {
    console.error(`[FAIL] ${error?.message ?? error}`);
    process.exit(1);
});
