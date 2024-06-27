import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano, TupleItemInt } from '@ton/core';
import { encodeOffChainContent } from './utils/content';

export type StakingConfig = {
    owner: Address;
    percentYear: bigint;
    lockupPeriod: number;
    collectionContent: string;
    commonContent: string;
    nftItemCode: Cell;
    royaltyParams: Cell;
};

export type StakingData = {
    percentYear: bigint;
    lockupPeriod: number;
    totalReward: bigint;
    currentReward: bigint;
}

export type CollectionData = {
    nextItemIndex: bigint;
    content: Cell;
    owner: Address;
}

export function buildNftCollectionContentCell(collectionContentUrl: string, commonContentUrl: string): Cell {
    let contentCell = beginCell();

    let collectionContent = encodeOffChainContent(collectionContentUrl);

    let commonContent = beginCell();
    commonContent.storeStringTail(commonContentUrl);

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent);

    return contentCell.endCell();
}
export function stakingConfigToCell(config: StakingConfig): Cell {
    return beginCell()
        .storeAddress(config.owner)
        .storeAddress(null)
        .storeUint(0, 64)
        .storeUint(config.percentYear, 64)
        .storeUint(config.lockupPeriod, 64)
        .storeCoins(0)
        .storeCoins(0)
        .storeRef(buildNftCollectionContentCell(config.collectionContent, config.commonContent))
        .storeRef(config.nftItemCode)
        .storeRef(config.royaltyParams)
    .endCell();
}

export class Staking implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Staking(address);
    }

    static createFromConfig(config: StakingConfig, code: Cell, workchain = 0) {
        const data = stakingConfigToCell(config);
        const init = { code, data };
        return new Staking(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendSetJettonWalletAddress(provider: ContractProvider, via: Sender, jettonWalletAddress: Address) {
        await provider.internal(via, {
            value: toNano('0.02'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0xee87d2d4, 32)
                .storeUint(0, 64)
                .storeAddress(jettonWalletAddress)
            .endCell(),
        });
    }

    async getJettonWalletAddress(provider: ContractProvider): Promise<Address | null> {
        const result = (await provider.get('get_jetton_wallet_address', [])).stack;
        return result.readAddress();
    }

    async getStakingData(provider: ContractProvider): Promise<StakingData> {
        const result = (await provider.get('get_staking_data', [])).stack;
        return {
            percentYear: result.readBigNumber(),
            lockupPeriod: result.readNumber(),
            totalReward: result.readBigNumber(),
            currentReward: result.readBigNumber()
        }
    }

    async getNftAddressByIndex(provider: ContractProvider, index: bigint): Promise<Address> {
        const result = (await provider.get('get_nft_address_by_index', [
            {
                type: 'int',
                value: index
            } as TupleItemInt
        ])).stack
        return result.readAddress();
    }

    async getCollectionData(provider: ContractProvider): Promise<CollectionData> {
        const result = (await provider.get('get_collection_data', [])).stack;
        return {
            nextItemIndex: result.readBigNumber(),
            content: result.readCell(),
            owner: result.readAddress()
        }
    }
}
