import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type NftItemConfig = {};

export type StakeInfo = {
    unlockTime: bigint;
    interest: bigint;
    stakeSize: bigint;
}

export function nftItemConfigToCell(config: NftItemConfig): Cell {
    return beginCell().endCell();
}

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftItemConfig, code: Cell, workchain = 0) {
        const data = nftItemConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendUnstake(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0xd5b5e9ad, 32)
                .storeUint(0, 64)
            .endCell(),
        });
    }

    async getStakeInfo(provider: ContractProvider): Promise<StakeInfo> {
        const result = (await provider.get('get_stake_info', [])).stack;
        return {
            unlockTime: result.readBigNumber(),
            interest: result.readBigNumber(),
            stakeSize: result.readBigNumber()
        }
    }
}
