import BonusPublisher from "../bonus-publisher";

describe("bonus-publisher", () => {
    describe("publishBonus", () => {
        it("should publishToUser with correct info", () => {
            // arrange
            const publisher = new BonusPublisher();
            publisher.publishToUser = jest.fn();

            // act
            publisher.publishBonus(1, { chest: 1, amount: 10 });

            // assert
            expect(publisher.publishToUser).toBeCalledWith(1, expect.objectContaining({ bonusChest: { chest: 1, amount: 10 } }));
        });
    });
});
