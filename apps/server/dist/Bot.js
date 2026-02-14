"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const scoring_1 = require("@step13/scoring");
class Bot {
    constructor(id, actor) {
        this.id = id;
        this.actor = actor;
        this.actor.subscribe((snapshot) => {
            this.state = snapshot;
            this.decide();
        });
    }
    decide() {
        if (!this.state)
            return;
        const { value, context } = this.state;
        const myTurn = context.currentTurn === this.id;
        if (value === 'handBuild' && !context.hands[this.id]) {
            this.buildHand(context.dealtTiles[this.id]);
        }
        if (value === 'gameLoop' && myTurn) {
            setTimeout(() => {
                this.discard(context.hands[this.id]);
            }, 1000);
        }
    }
    buildHand(tiles) {
        if (!tiles)
            return;
        const hand = tiles.slice(0, 13);
        const pool = tiles.slice(13);
        if ((0, scoring_1.isTenpai)(hand)) {
            this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand, pool });
        }
        else {
            console.log(`Bot ${this.id} failed to build Tenpai. Retrying... (Not implemented)`);
        }
    }
    discard(hand) {
        if (!hand || hand.length === 0)
            return;
        const randomIndex = Math.floor(Math.random() * hand.length);
        const tile = hand[randomIndex];
        if (tile && tile.id) {
            console.log(`Bot ${this.id} discarding ${tile.suit}${tile.rank}`);
            this.actor.send({ type: 'DISCARD', playerId: this.id, tileId: tile.id });
        }
    }
}
exports.Bot = Bot;
//# sourceMappingURL=Bot.js.map