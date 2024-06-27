import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type MockWalletConfig = {};

export function mockWalletConfigToCell(config: MockWalletConfig): Cell {
    return beginCell().endCell();
}

export class MockWallet implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MockWallet(address);
    }

    static createFromConfig(config: MockWalletConfig, code: Cell, workchain = 0) {
        const data = mockWalletConfigToCell(config);
        const init = { code, data };
        return new MockWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(provider: ContractProvider, via: Sender,
        opts: {
            toAddress: Address;
            fwdAmount: bigint;
            jettonAmount: bigint;
            fwdPayload?: Cell;
        }
    ) {
        let body = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toAddress)
            .storeAddress(via.address)
            .storeUint(0, 1)
            .storeCoins(opts.fwdAmount)
            .storeBit(!!opts.fwdPayload)

        if (!!opts.fwdPayload)
            body.storeRef(opts.fwdPayload || null)
        
        await provider.internal(via, {
            value: toNano('0.05') + opts.fwdAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body.endCell(),
        });
    }

    async getJettonBalance(provider: ContractProvider): Promise<bigint> {
        const result = (await provider.get('get_wallet_data', [])).stack;
        return result.readBigNumber()
    }
}
