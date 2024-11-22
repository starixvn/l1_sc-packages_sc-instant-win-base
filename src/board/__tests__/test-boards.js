import defaultDefinition from "../default-definition";

export const createSymbol = (id) => ({
    id,
    pays: defaultDefinition.symbols[id].pays,
    isWild: defaultDefinition.symbols[id]?.isWild || false,
});

export const createWildSymbol = (multiplier) => ({
    id: "WILD",
    pays: defaultDefinition.symbols.WILD.pays,
    isWild: true,
    multiplier,
});

export const boards = {
    threeHarry: [
        [createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("K"), createSymbol("Q")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    fourHarry: [
        [createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("Q")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    fiveHarry: [
        [createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("HARRY")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    threeHarryWithWild: [
        [createSymbol("HARRY"), createWildSymbol(2), createSymbol("HARRY"), createSymbol("K"), createSymbol("Q")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    fourHarryWithWild: [
        [createSymbol("HARRY"), createWildSymbol(2), createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("Q")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    fiveHarryWithMultipleWilds: [
        [createSymbol("HARRY"), createWildSymbol(2), createWildSymbol(3), createSymbol("HARRY"), createSymbol("HARRY")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    noWin: [
        [createSymbol("HARRY"), createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],

    twoMatchOnly: [
        [createSymbol("HARRY"), createSymbol("HARRY"), createSymbol("Q"), createSymbol("J"), createSymbol("T")],
        [createSymbol("K"), createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("A")],
        [createSymbol("Q"), createSymbol("J"), createSymbol("T"), createSymbol("K"), createSymbol("J")],
    ],
};
