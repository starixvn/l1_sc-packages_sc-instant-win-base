import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { HallOfFameConsumer } from "..";

/** @type {mongoose.Model}*/
const famesRepository = stubMongooseModelStupidly(mongoose.Model);

describe("add", () => {
    it("should create new record in fames repository", async () => {
        // arrange
        const fameConsumer = new HallOfFameConsumer(famesRepository);
        const player = {
            UID: "uid",
            session: { memberId: 12 },
            profile: { name: "a" },
        };
        const fame = {
            roundId: 1,
            bet: 5,
            totalAmount: 5,
            winningAmount: 25,
            numberOfPaylines: 5,
            freeSpin: false,
        };

        // act
        await fameConsumer.add(player, fame);

        // assert
        expect(famesRepository.create).toBeCalled();
    });
});
