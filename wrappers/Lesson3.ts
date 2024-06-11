import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type Lesson3Config = {
    receiver: Address;
    admin: Address;
};

export function lesson3ConfigToCell(config: Lesson3Config): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeAddress(config.receiver)
        .storeAddress(config.admin)
    .endCell();
}

export class Lesson3 implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Lesson3(address);
    }

    static createFromConfig(config: Lesson3Config, code: Cell, workchain = 0) {
        const data = lesson3ConfigToCell(config);
        const init = { code, data };
        return new Lesson3(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendFunds(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6f074817, 32)
            .endCell(),
        });
    }

    async sendLock(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x878f9b0e, 32)
            .endCell(),
        });
    }

    async sendUnlock(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x6ae4b0ef, 32)
            .endCell(),
        });
    }

    async getIsLocked(provider: ContractProvider): Promise<number> {
        const res = (await provider.get('get_is_locked', [])).stack;
        return res.readNumber();
    }
}
